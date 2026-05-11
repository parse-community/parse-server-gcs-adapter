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
    throw `GCSAdapter requires an ${key}`;
  }
  return options;
}

function stringFromEnvironmentOrDefault(
  options: GCSAdapterOptions,
  key: 'projectId' | 'keyFilename' | 'bucketPrefix',
  env: string,
  defaultValue?: string
): GCSAdapterOptions {
  options[key] = options[key] || process.env[env] || defaultValue;
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
    const params = {
      metadata: {
        contentType: contentType || 'application/octet-stream'
      }
    };

    return new Promise((resolve, reject) => {
      const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
      // gcloud supports upload(file) not upload(bytes), so we need to stream.
      const uploadStream = file.createWriteStream(params);
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
    return new Promise((resolve, reject) => {
      const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
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
    return new Promise((resolve, reject) => {
      const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
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
          reject(err);
        }
      });
    });
  }

  // Generates and returns the location of a file stored in GCS for the given request and filename.
  // The location is the direct GCS link if the option is set,
  // otherwise we serve the file through parse-server.
  getFileLocation(config: { mount: string; applicationId: string }, filename: string): string {
    if (this._directAccess) {
      return `https://storage.googleapis.com/${this._bucket}/${this._bucketPrefix + filename}`;
    }
    return `${config.mount}/files/${config.applicationId}/${encodeURIComponent(filename)}`;
  }
}

export default GCSAdapter;

module.exports = GCSAdapter;
module.exports.default = GCSAdapter;
