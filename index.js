'use strict';
// GCSAdapter
// Store Parse Files in Google Cloud Storage: https://cloud.google.com/storage
// nodejs-storage client readme: https://github.com/googleapis/nodejs-storage#readme
const storage = require('@google-cloud/storage');

function requiredOrFromEnvironment(options, key, env) {
  options[key] = options[key] || process.env[env];
  if (!options[key]) {
    throw `GCSAdapter requires an ${key}`;
  }
  return options;
}

function fromEnvironmentOrDefault(options, key, env, defaultValue) {
  options[key] = options[key] || process.env[env] || defaultValue;
  return options;
}

function optionsFromArguments(args) {
  let options = {};
  let projectIdOrOptions = args[0];
  if (typeof projectIdOrOptions == 'string') {
    options.projectId = projectIdOrOptions;
    options.keyFilename = args[1];
    options.bucket = args[2];
    let otherOptions = args[3];
    if (otherOptions) {
      options.bucketPrefix = otherOptions.bucketPrefix;
      options.directAccess = otherOptions.directAccess;
    }
  } else {
    options = Object.assign( {}, projectIdOrOptions);
  }
  options = fromEnvironmentOrDefault(options, 'projectId', 'GCP_PROJECT_ID', undefined);
  options = fromEnvironmentOrDefault(options, 'keyFilename', 'GCP_KEYFILE_PATH', undefined);
  options = requiredOrFromEnvironment(options, 'bucket', 'GCS_BUCKET');
  options = fromEnvironmentOrDefault(options, 'bucketPrefix', 'GCS_BUCKET_PREFIX', '');
  options = fromEnvironmentOrDefault(options, 'directAccess', 'GCS_DIRECT_ACCESS', false);
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
function GCSAdapter() {
  let options = optionsFromArguments(arguments);

  this._bucket = options.bucket;
  this._bucketPrefix = options.bucketPrefix;
  this._directAccess = options.directAccess;

  this._gcsClient = new storage(options);
}

GCSAdapter.prototype.createFile = function(filename, data, contentType) {
  let params = {
    metadata: {
	contentType: contentType || 'application/octet-stream'
    }    
  };

  async function uploadFile() {
    await this._gcsClient.bucket(this._bucket).upload(this._bucketPrefix + filename, {
	gzip: true,
	params,
    });

    console.log(`${filename} uploaded to ${bucketName}.`);
  }

  uploadFile().catch(console.error);
}

GCSAdapter.prototype.deleteFile = function(filename) {
    async function deleteFile() {
      await this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename).delete();
      console.log(`${this._bucket} ${filename} deleted.`);
    }

    deleteFile().catch(console.error);
}

// Search for and return a file if found by filename.
// Returns a promise that succeeds with the buffer result from GCS, or fails with an error.
GCSAdapter.prototype.getFileData = function(filename) {
    async function downloadFile() {
      const options = {
        destination: filename,
      };
      await this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename).download(options);

      console.log(`${this._bucket} ${filename} downloaded.`);
    }
    downloadFile().catch(console.error);
}

// Generates and returns the location of a file stored in GCS for the given request and filename.
// The location is the direct GCS link if the option is set,
// otherwise we serve the file through parse-server.
GCSAdapter.prototype.getFileLocation = function(config, filename) {
  if (this._directAccess) {
    return `https://storage.googleapis.com/${this._bucket}/${this._bucketPrefix + filename}`;
  }
  return (config.mount + '/files/' + config.applicationId + '/' + encodeURIComponent(filename));
}

module.exports = GCSAdapter;
module.exports.default = GCSAdapter;
