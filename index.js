'use strict';
// GCSAdapter
// Store Parse Files in Google Cloud Storage: https://cloud.google.com/storage
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
    },
    resumable: false
  };

  return new Promise((resolve, reject) => {
    let file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
    // gcloud supports upload(file) not upload(bytes), so we need to stream.
    var uploadStream = file.createWriteStream(params);
    uploadStream.on('error', (err) => {
      return reject(err);
    }).on('finish', () => {
      // Second call to set public read ACL after object is uploaded.
      if (this._directAccess) {
        file.makePublic((err, res) => {
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

GCSAdapter.prototype.deleteFile = function(filename) {
  return new Promise((resolve, reject) => {
    let file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
    file.delete((err, res) => {
      if(err !== null) {
        return reject(err);
      }
      resolve(res);
    });
  });
}

// Search for and return a file if found by filename.
// Returns a promise that succeeds with the buffer result from GCS, or fails with an error.
GCSAdapter.prototype.getFileData = function(filename) {
  return new Promise((resolve, reject) => {
    let file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
    // Check for existence, since gcloud-node seemed to be caching the result
    file.exists((err, exists) => {
      if (exists) {
        file.download((err, data) => {
          if (err !== null) {
            return reject(err);
          }
          return resolve(data);
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
GCSAdapter.prototype.getFileLocation = function(config, filename) {
  if (this._directAccess) {
    return `https://storage.googleapis.com/${this._bucket}/${this._bucketPrefix + filename}`;
  }
  return (config.mount + '/files/' + config.applicationId + '/' + encodeURIComponent(filename));
}

module.exports = GCSAdapter;
module.exports.default = GCSAdapter;
