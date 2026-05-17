'use strict';

import { Storage, StorageOptions } from '@google-cloud/storage';

interface GCSAdapterOptions extends StorageOptions {
  bucket?: string;
  bucketPrefix?: string;
  directAccess?: boolean | string;
}

interface ResolvedGCSAdapterOptions extends StorageOptions {
  bucket: string;
  bucketPrefix: string;
  directAccess: boolean;
}

interface LegacyOptions {
  bucketPrefix?: string;
  directAccess?: boolean | string;
}

type GCSClient = {
  bucket(name: string): {
    file(name: string): {
      createWriteStream(params: { metadata: { contentType: string } }): NodeJS.WritableStream;
      delete(callback: (err: Error | null, response?: unknown) => void): void;
      download(callback: (err: Error | null, data?: Buffer) => void): void;
      exists(callback: (err: Error | null, exists?: boolean) => void): void;
      makePublic(callback: (err: Error | null, response?: unknown) => void): void;
    };
  };
};

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

function fromEnvironmentOrDefault<K extends keyof GCSAdapterOptions>(
  options: GCSAdapterOptions,
  key: K,
  env: string,
  defaultValue: GCSAdapterOptions[K]
): GCSAdapterOptions {
  options[key] = options[key] || (process.env[env] as GCSAdapterOptions[K]) || defaultValue;
  return options;
}

function normalizeDirectAccess(directAccess: boolean | string | undefined): boolean {
  if (typeof directAccess === 'boolean') {
    return directAccess;
  }
  if (typeof directAccess === 'string') {
    return ['true', '1', 'yes'].includes(directAccess.trim().toLowerCase());
  }
  return false;
}

function optionsFromArguments(
  projectIdOrOptions?: string | GCSAdapterOptions,
  keyFilename?: string,
  bucket?: string,
  otherOptions?: LegacyOptions
): ResolvedGCSAdapterOptions {
  let options: GCSAdapterOptions = {};
  if (typeof projectIdOrOptions === 'string') {
    options.projectId = projectIdOrOptions;
    options.keyFilename = keyFilename;
    options.bucket = bucket;
    if (otherOptions) {
      options.bucketPrefix = otherOptions.bucketPrefix;
      options.directAccess = otherOptions.directAccess;
    }
  } else {
    options = Object.assign({}, projectIdOrOptions);
  }
  options = fromEnvironmentOrDefault(options, 'projectId', 'GCP_PROJECT_ID', undefined);
  options = fromEnvironmentOrDefault(options, 'keyFilename', 'GCP_KEYFILE_PATH', undefined);
  options = requiredOrFromEnvironment(options, 'bucket', 'GCS_BUCKET');
  options = fromEnvironmentOrDefault(options, 'bucketPrefix', 'GCS_BUCKET_PREFIX', '');
  if (options.directAccess == null) {
    options.directAccess = process.env.GCS_DIRECT_ACCESS || false;
  }
  options.directAccess = normalizeDirectAccess(options.directAccess);
  return options as ResolvedGCSAdapterOptions;
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
  static default: typeof GCSAdapter;

  _bucket: string;
  _bucketPrefix: string;
  _directAccess: boolean;
  _gcsClient: GCSClient;

  constructor(
    projectIdOrOptions?: string | GCSAdapterOptions,
    keyFilename?: string,
    bucket?: string,
    otherOptions?: LegacyOptions
  ) {
    const options = optionsFromArguments(projectIdOrOptions, keyFilename, bucket, otherOptions);

    this._bucket = options.bucket;
    this._bucketPrefix = options.bucketPrefix;
    this._directAccess = options.directAccess;

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
      uploadStream.on('error', err => {
        return reject(err);
      }).on('finish', () => {
        // Second call to set public read ACL after object is uploaded.
        if (this._directAccess) {
          file.makePublic(err => {
            if (err !== null) {
              return reject(err);
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
      file.delete((err, res) => {
        if (err !== null) {
          return reject(err);
        }
        resolve(res);
      });
    });
  }

  // Search for and return a file if found by filename.
  // Returns a promise that succeeds with the buffer result from GCS, or fails with an error.
  getFileData(filename: string): Promise<Buffer | undefined> {
    return new Promise((resolve, reject) => {
      const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
      // Check for existence, since gcloud-node seemed to be caching the result
      file.exists((err, exists) => {
        if (err !== null) {
          return reject(err);
        }
        if (!exists) {
          return resolve(undefined);
        }
        file.download((downloadErr, data) => {
          if (downloadErr !== null) {
            return reject(downloadErr);
          }
          return resolve(data);
        });
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
    return config.mount + '/files/' + config.applicationId + '/' + encodeURIComponent(filename);
  }
}

GCSAdapter.default = GCSAdapter;
export = GCSAdapter;
