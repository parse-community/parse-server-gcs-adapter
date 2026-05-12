import { Storage, type StorageOptions } from '@google-cloud/storage';

interface OtherOptions {
  bucketPrefix?: string;
  directAccess?: boolean;
}

interface GCSAdapterOptions extends StorageOptions {
  bucket?: string;
  bucketPrefix?: string;
  directAccess?: boolean;
}

type GCSAdapterArgs =
  | []
  | [GCSAdapterOptions]
  | [string, string | undefined, string | undefined, OtherOptions?];

function requiredOrFromEnvironment(
  options: GCSAdapterOptions,
  key: 'bucket',
  env: string
): GCSAdapterOptions {
  options[key] = options[key] || process.env[env];
  if (!options[key]) {
    throw new Error(`GCSAdapter requires an ${key}`);
  }
  return options;
}

function stringFromEnvironmentOrDefault(
  options: GCSAdapterOptions,
  key: 'projectId' | 'keyFilename' | 'bucketPrefix',
  env: string,
  defaultValue?: string
): GCSAdapterOptions {
  if (options[key] === undefined) {
    options[key] = process.env[env] !== undefined ? process.env[env] : defaultValue;
  }
  return options;
}

function booleanFromEnvironmentOrDefault(
  options: GCSAdapterOptions,
  key: 'directAccess',
  env: string,
  defaultValue: boolean
): GCSAdapterOptions {
  if (typeof options[key] !== 'boolean') {
    options[key] = process.env[env] === 'true' || defaultValue;
  }
  return options;
}

function contentTypeOrDefault(contentType?: string): string {
  const resolvedContentType = contentType || 'application/octet-stream';
  if (/[\r\n]/.test(resolvedContentType)) {
    throw new Error('GCSAdapter contentType cannot contain line breaks');
  }
  return resolvedContentType;
}

function validateFilePath(filePath: string): string {
  if (!filePath || filePath.startsWith('/') || filePath.includes('\\')) {
    throw new Error('GCSAdapter filename must be a relative Google Cloud Storage object name');
  }

  if (filePath.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('GCSAdapter filename cannot contain relative path segments');
  }

  return filePath;
}

function encodeGCSObjectName(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

function optionsFromArguments(args: IArguments): GCSAdapterOptions {
  let options: GCSAdapterOptions = {};
  const projectIdOrOptions = args[0] as string | GCSAdapterOptions | undefined;

  if (typeof projectIdOrOptions === 'string') {
    options.projectId = projectIdOrOptions;
    options.keyFilename = args[1] as string | undefined;
    options.bucket = args[2] as string | undefined;
    const otherOptions = args[3] as OtherOptions | undefined;
    if (otherOptions) {
      options.bucketPrefix = otherOptions.bucketPrefix;
      options.directAccess = otherOptions.directAccess;
    }
  } else {
    options = { ...projectIdOrOptions };
  }

  options = stringFromEnvironmentOrDefault(options, 'projectId', 'GCP_PROJECT_ID');
  options = stringFromEnvironmentOrDefault(options, 'keyFilename', 'GCP_KEYFILE_PATH');
  options = requiredOrFromEnvironment(options, 'bucket', 'GCS_BUCKET');
  options = stringFromEnvironmentOrDefault(options, 'bucketPrefix', 'GCS_BUCKET_PREFIX', '');
  options = booleanFromEnvironmentOrDefault(options, 'directAccess', 'GCS_DIRECT_ACCESS', false);
  return options;
}

/*
supported options

*projectId / 'GCP_PROJECT_ID'
*keyFilename / 'GCP_KEYFILE_PATH'
*bucket / 'GCS_BUCKET'
{ bucketPrefix / 'GCS_BUCKET_PREFIX' defaults to ''
directAccess / 'GCS_DIRECT_ACCESS' defaults to false
*/
class GCSAdapter {
  private readonly _bucket: string;
  private readonly _bucketPrefix: string;
  private readonly _directAccess: boolean;
  private _gcsClient: Storage;

  constructor(...args: GCSAdapterArgs) {
    const options = optionsFromArguments(arguments);

    this._bucket = options.bucket as string;
    this._bucketPrefix = options.bucketPrefix as string;
    this._directAccess = options.directAccess as boolean;

    this._gcsClient = new Storage(options);
  }

  createFile(filename: string, data: Buffer | string, contentType?: string): Promise<void> {
    let filePath: string;
    let resolvedContentType: string;
    try {
      filePath = this.filePath(filename);
      resolvedContentType = contentTypeOrDefault(contentType);
    } catch (err) {
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      const file = this._gcsClient.bucket(this._bucket).file(filePath);
      // gcloud supports upload(file) not upload(bytes), so we need to stream.
      const uploadStream = file.createWriteStream({
        metadata: {
          contentType: resolvedContentType
        }
      });
      uploadStream.on('error', (err) => {
        reject(err);
      }).on('finish', () => {
        // Second call to set public read ACL after object is uploaded.
        if (this._directAccess) {
          file.makePublic((err) => {
            if (err !== null) {
              reject(err);
              return;
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
      uploadStream.write(data);
      uploadStream.end();
    });
  }

  deleteFile(filename: string): Promise<unknown> {
    let filePath: string;
    try {
      filePath = this.filePath(filename);
    } catch (err) {
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      const file = this._gcsClient.bucket(this._bucket).file(filePath);
      file.delete((err, response) => {
        if (err !== null) {
          reject(err);
          return;
        }
        resolve(response);
      });
    });
  }

  // Search for and return a file if found by filename.
  // Returns a promise that succeeds with the buffer result from GCS, or fails with an error.
  getFileData(filename: string): Promise<Buffer> {
    let filePath: string;
    try {
      filePath = this.filePath(filename);
    } catch (err) {
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      const file = this._gcsClient.bucket(this._bucket).file(filePath);
      // Check for existence, since gcloud-node seemed to be caching the result
      file.exists((err: Error | null, exists: boolean) => {
        if (exists) {
          file.download((downloadError, data) => {
            if (downloadError !== null) {
              reject(downloadError);
              return;
            }
            resolve(data);
          });
        } else {
          reject(err || new Error(`File ${filename} does not exist.`));
        }
      });
    });
  }

  // Generates and returns the location of a file stored in GCS for the given request and filename.
  // The location is the direct GCS link if the option is set,
  // otherwise we serve the file through parse-server.
  getFileLocation(config: { mount: string; applicationId: string }, filename: string): string {
    const filePath = this.filePath(filename);
    if (this._directAccess) {
      return `https://storage.googleapis.com/${this._bucket}/${encodeGCSObjectName(filePath)}`;
    }
    return `${config.mount}/files/${config.applicationId}/${encodeURIComponent(filename)}`;
  }

  private filePath(filename: string): string {
    return validateFilePath(this._bucketPrefix + filename);
  }
}

export default GCSAdapter;

module.exports = GCSAdapter;
module.exports.default = GCSAdapter;
