interface GCSAdapterOptions {
    projectId?: string;
    keyFilename?: string;
    bucket: string;
    bucketPrefix?: string;
    directAccess?: boolean;
    baseUrl?: string;
}
type GCSAdapterConstructorArgs = [GCSAdapterOptions];
declare class GCSAdapter {
    private _bucket;
    private _bucketPrefix;
    private _directAccess;
    private _gcsClient;
    private _baseUrl;
    constructor(...args: GCSAdapterConstructorArgs);
    createFile(filename: string, data: Buffer | string, contentType?: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    getFileData(filename: string): Promise<Buffer>;
    getFileLocation(config: {
        mount: string;
        applicationId: string;
    }, filename: string): string;
}

export { GCSAdapter as default };
