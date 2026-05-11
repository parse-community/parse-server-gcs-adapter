import { type StorageOptions } from '@google-cloud/storage';
interface OtherOptions {
    bucketPrefix?: string;
    directAccess?: boolean;
}
interface GCSAdapterOptions extends StorageOptions {
    bucket?: string;
    bucketPrefix?: string;
    directAccess?: boolean;
}
type GCSAdapterArgs = [] | [GCSAdapterOptions] | [string, string | undefined, string | undefined, OtherOptions?];
declare class GCSAdapter {
    private readonly _bucket;
    private readonly _bucketPrefix;
    private readonly _directAccess;
    private _gcsClient;
    constructor(...args: GCSAdapterArgs);
    createFile(filename: string, data: Buffer | string, contentType?: string): Promise<void>;
    deleteFile(filename: string): Promise<unknown>;
    getFileData(filename: string): Promise<Buffer>;
    getFileLocation(config: {
        mount: string;
        applicationId: string;
    }, filename: string): string;
    private filePath;
}
export default GCSAdapter;
