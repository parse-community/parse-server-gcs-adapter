# Parse Server GCS Adapter <!-- omit in toc -->

[![Build Status](https://github.com/parse-community/parse-server-gcs-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/parse-community/parse-server-gcs-adapter/actions/workflows/ci.yml?query=workflow%3Aci+branch%main)
[![Snyk Badge](https://snyk.io/test/github/parse-community/parse-server-gcs-adapter/badge.svg)](https://snyk.io/test/github/parse-community/parse-server-gcs-adapter)
[![Coverage](https://img.shields.io/codecov/c/github/parse-community/parse-server-gcs-adapter/main.svg)](https://codecov.io/github/parse-community/parse-server-gcs-adapter?branch=main)
[![auto-release](https://img.shields.io/badge/%F0%9F%9A%80-auto--release-9e34eb.svg)](https://github.com/parse-community/parse-server-gcs-adapter/releases)

[![Node Version](https://img.shields.io/badge/nodejs-18,_20,_22-green.svg?logo=node.js&style=flat)](https://nodejs.org)
[![npm latest version](https://img.shields.io/npm/v/@parse/gcs-files-adapter.svg)](https://www.npmjs.com/package/@parse/gcs-files-adapter)

---

The Parse Server Google Cloud Storage Adapter.

---


- [Installation](#installation)
- [Usage with Parse Server](#usage-with-parse-server)
    - [Config File](#config-file)
    - [Environment Variables](#environment-variables)
    - [Instance Parameters](#instance-parameters)
  - [Options](#options)
  - [Obtaining Credentials File](#obtaining-credentials-file)

# Installation

`npm install --save @parse/gcs-files-adapter`

# Usage with Parse Server

### Config File

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

### Environment Variables

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


### Instance Parameters

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

- `directAccess`: if set to `true`, uploaded files will be set as public and files will be served directly by Google Cloud Storage. Default is `false` and files are proxied by Parse Server.

## Obtaining Credentials File

See the [Google Cloud documentation](https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually) for how to generate a key file with credentials.
