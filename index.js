"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const storage_1 = require("@google-cloud/storage");
function requiredOrFromEnvironment(options, key, env) {
    options[key] = options[key] || process.env[env];
    if (!options[key]) {
        throw new Error(`GCSAdapter requires an ${key}`);
    }
    return options;
}
function stringFromEnvironmentOrDefault(options, key, env, defaultValue) {
    options[key] = options[key] || process.env[env] || defaultValue;
    return options;
}
function booleanFromEnvironmentOrDefault(options, key, env, defaultValue) {
    if (typeof options[key] !== 'boolean') {
        options[key] = process.env[env] === 'true' || defaultValue;
    }
    return options;
}
function contentTypeOrDefault(contentType) {
    const resolvedContentType = contentType || 'application/octet-stream';
    if (/[\r\n]/.test(resolvedContentType)) {
        throw new Error('GCSAdapter contentType cannot contain line breaks');
    }
    return resolvedContentType;
}
function validateFilePath(filePath) {
    if (!filePath || filePath.startsWith('/') || filePath.includes('\\')) {
        throw new Error('GCSAdapter filename must be a relative Google Cloud Storage object name');
    }
    if (filePath.split('/').some((part) => part === '.' || part === '..')) {
        throw new Error('GCSAdapter filename cannot contain relative path segments');
    }
    return filePath;
}
function encodeGCSObjectName(filePath) {
    return filePath.split('/').map(encodeURIComponent).join('/');
}
function optionsFromArguments(args) {
    let options = {};
    const projectIdOrOptions = args[0];
    if (typeof projectIdOrOptions === 'string') {
        options.projectId = projectIdOrOptions;
        options.keyFilename = args[1];
        options.bucket = args[2];
        const otherOptions = args[3];
        if (otherOptions) {
            options.bucketPrefix = otherOptions.bucketPrefix;
            options.directAccess = otherOptions.directAccess;
        }
    }
    else {
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
    constructor(...args) {
        const options = optionsFromArguments(arguments);
        this._bucket = options.bucket;
        this._bucketPrefix = options.bucketPrefix;
        this._directAccess = options.directAccess;
        this._gcsClient = new storage_1.Storage(options);
    }
    createFile(filename, data, contentType) {
        let filePath;
        let resolvedContentType;
        try {
            filePath = this.filePath(filename);
            resolvedContentType = contentTypeOrDefault(contentType);
        }
        catch (err) {
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
                }
                else {
                    resolve();
                }
            });
            uploadStream.write(data);
            uploadStream.end();
        });
    }
    deleteFile(filename) {
        let filePath;
        try {
            filePath = this.filePath(filename);
        }
        catch (err) {
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
    getFileData(filename) {
        let filePath;
        try {
            filePath = this.filePath(filename);
        }
        catch (err) {
            return Promise.reject(err);
        }
        return new Promise((resolve, reject) => {
            const file = this._gcsClient.bucket(this._bucket).file(filePath);
            // Check for existence, since gcloud-node seemed to be caching the result
            file.exists((err, exists) => {
                if (exists) {
                    file.download((downloadError, data) => {
                        if (downloadError !== null) {
                            reject(downloadError);
                            return;
                        }
                        resolve(data);
                    });
                }
                else {
                    reject(err || new Error(`File ${filename} does not exist.`));
                }
            });
        });
    }
    // Generates and returns the location of a file stored in GCS for the given request and filename.
    // The location is the direct GCS link if the option is set,
    // otherwise we serve the file through parse-server.
    getFileLocation(config, filename) {
        const filePath = this.filePath(filename);
        if (this._directAccess) {
            return `https://storage.googleapis.com/${this._bucket}/${encodeGCSObjectName(filePath)}`;
        }
        return `${config.mount}/files/${config.applicationId}/${encodeURIComponent(filename)}`;
    }
    filePath(filename) {
        return validateFilePath(this._bucketPrefix + filename);
    }
}
exports.default = GCSAdapter;
module.exports = GCSAdapter;
module.exports.default = GCSAdapter;
