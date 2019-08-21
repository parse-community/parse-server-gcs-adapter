# parse-server-gcs-adapter

[![Greenkeeper badge](https://badges.greenkeeper.io/parse-server-modules/parse-server-gcs-adapter.svg)](https://greenkeeper.io/)
[![Build
Status](https://travis-ci.org/parse-community/parse-server-gcs-adapter.svg?branch=master)](https://travis-ci.org/parse-community/parse-server-gcs-adapter)
[![codecov.io](https://codecov.io/github/parse-community/parse-server-gcs-adapter/coverage.svg?branch=master)](https://codecov.io/github/parse-community/parse-server-gcs-adapter?branch=master)
[![NPM Version](https://img.shields.io/npm/v/@parse/gcs-files-adapter.svg?style=flat-square)](https://www.npmjs.com/package/@parse/gcs-files-adapter)

parse-server adapter for Google Cloud Storage

# installation

`npm install --save @parse/gcs-files-adapter`

# usage with parse-server

### using a config file

```js
{
  // Parse server options
  appId: 'my_app_id',
  masterKey: 'my_master_key',
  // other options
  filesAdapter: {
    module: '@parse/gcs-files-adapter',
    options: {
      projectId: 'projectId',
      keyFilename: '/path/to/keyfile',
      bucket: 'my_bucket',
      // optional:
      bucketPrefix: '', // default value
      directAccess: false // default value
    } 
  }
}
```

### using environment variables

Set your environment variables:

```
GCP_PROJECT_ID=projectId
GCP_KEYFILE_PATH=/path/to/keyfile
GCS_BUCKET=bucketName
```

And update your config / options

```js
{
  // Parse server options
  appId: 'my_app_id',
  masterKey: 'my_master_key',
  // other options
  filesAdapter: '@parse/gcs-files-adapter'
}
```

Alternatively, you can use

`GCLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS` environment variables.


### passing as an instance

```js
var GCSAdapter = require('@parse/gcs-files-adapter');

var gcsAdapter = new GCSAdapter(
  'project', 
  'keyFilePath', 
  'bucket' , {
    bucketPrefix: '',
    directAccess: false
  }
);

var api = new ParseServer({
  appId: 'my_app',
  masterKey: 'master_key',
  filesAdapter: gcsAdapter
})
```

or with an options hash

```js
var GCSAdapter = require('@parse/gcs-files-adapter');

var gcsOptions = {
  projectId: 'projectId',
  keyFilename: '/path/to/keyfile',
  bucket: 'my_bucket',
  bucketPrefix: '',
  directAccess: false
}

var gcsAdapter = new GCSAdapter(gcsOptions);

var api = new ParseServer({
  appId: 'my_app',
  masterKey: 'master_key',
  filesAdapter: gcsAdapter
});
```

## Options
 - `directAccess` if set to `true`, uploaded files will be set as public and files will be served directly by Google Cloud Storage. Default is `false` and files are proxied by Parse server.

## Obtaining credentials file
 Visit [Google Cloud documentation page](https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually) to see how to generate key file with credentials
