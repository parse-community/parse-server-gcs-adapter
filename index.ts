import { Storage, StorageOptions } from '@google-cloud/storage';


interface GCSAdapterOptions {
  projectId?: string;
  keyFilename?: string;
  bucket: string;
  bucketPrefix?: string;
  directAccess?: boolean;
  baseUrl?: string;
}

type GCSAdapterConstructorArgs = [GCSAdapterOptions];
function optionsFromArguments(args: GCSAdapterConstructorArgs): GCSAdapterOptions {
  const defaultOptions: Partial<GCSAdapterOptions> = {
    projectId: process.env['GCP_PROJECT_ID'],
    keyFilename: process.env['GCP_KEYFILE_PATH'],
    bucket: process.env['GCS_BUCKET'],
    bucketPrefix: process.env['GCS_BUCKET_PREFIX'] || '',
    directAccess: process.env['GCS_DIRECT_ACCESS'] === 'true' ? true : false
  };

  return {
    ...defaultOptions,
    ...args[0]
  };
}

class GCSAdapter {
  private _bucket: string;
  private _bucketPrefix: string;
  private _directAccess: boolean;
  private _gcsClient: Storage;
  private _baseUrl: string;

  constructor(...args: GCSAdapterConstructorArgs) {
    let options = optionsFromArguments(args);

    this._bucket = options.bucket;
    this._bucketPrefix = options.bucketPrefix || '';
    this._directAccess = options.directAccess || false;
    this._baseUrl = options.baseUrl || 'https://storage.googleapis.com/';
    this._gcsClient = new Storage(options as StorageOptions);
  }

  async createFile(filename: string, data: Buffer | string, contentType?: string): Promise<void> {
    const params = {
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
    };

    const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
    await new Promise((resolve, reject) => {
      const uploadStream = file.createWriteStream(params);
      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
      uploadStream.end(data);
    });

    if (this._directAccess) {
      await file.makePublic().catch(err => {
        throw new Error(`Error making file public: ${err}`);
      });
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
      await file.delete();
    } catch (err) {
      throw new Error(`Error deleting file ${filename}: ${err}`);
    }
  }

  async getFileData(filename: string): Promise<Buffer> {
    try {
      const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File ${filename} does not exist.`);
      }
      const [data] = await file.download();
      return data;
    } catch (err) {
      throw new Error(`Error downloading file ${filename}: ${err}`);
    }
  }


  getFileLocation(config: { mount: string; applicationId: string; }, filename: string): string {
    if (this._directAccess) {
      return `${this._baseUrl}${this._bucket}/${this._bucketPrefix + filename}`;
    }
    return `${config.mount}/files/${config.applicationId}/${encodeURIComponent(filename)}`;
  }
}


export default GCSAdapter;