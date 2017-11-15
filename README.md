# parse-server-gcs-adapter
[![Build
Status](https://travis-ci.org/parse-community/parse-server-gcs-adapter.svg?branch=master)](https://travis-ci.org/parse-community/parse-server-gcs-adapter)
[![codecov.io](https://codecov.io/github/parse-community/parse-server-gcs-adapter/coverage.svg?branch=master)](https://codecov.io/github/parse-community/parse-server-gcs-adapter?branch=master)
[![NPM Version](https://img.shields.io/npm/v/@parse/gcs-files-adapter.svg?style=flat-square)](https://www.npmjs.com/package/@parse/gcs-files-adapter)

parse-server adapter for Google Cloud Storage

# installation

`npm install --save @parse/gcs-files-adapter`

# usage with parse-server

### using a config file

```
{
  "appId": 'my_app_id',
  "masterKey": 'my_master_key',
  // other options
  "filesAdapter": {
    "module": "@parse/gcs-files-adapter",
    "options": {
      "projectId": "projectId",
      "keyFilename": "path/to/keyfile",
      "bucket": "my_bucket",
      // optional:
      "bucketPrefix": '', // default value
      "directAccess": false // default value
    } 
  }
}
```

### using environment variables

Set your environment variables:

```
GCP_PROJECT_ID=projectId
GCP_KEYFILE_PATH=projectId
GCS_BUCKET=bucketName
```

And update your config / options

```
{
  "appId": 'my_app_id',
  "masterKey": 'my_master_key',
  // other options
  "filesAdapter": "parse-server-gcs-adapter"
}
```

Alternatively, you can use

`GCLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS` environment variables.


### passing as an instance

```
var GCSAdapter = require('@parse/gcs-files-adapter');

var gcsAdapter = new GCSAdapter('project', 
								'keyFilePath', 
								'bucket' , {
									bucketPrefix: '',
									directAccess: false
								});

var api = new ParseServer({
	appId: 'my_app',
	masterKey: 'master_key',
	filesAdapter: gcsAdapter
})
```

or with an options hash

```
var GCSAdapter = require('@parse/gcs-files-adapter');

var gcsOptions = {
	"projectId": "projectId",
    "keyFilename": "path/to/keyfile",
    "bucket": "my_bucket",
    "bucketPrefix": '',
	"directAccess": false
}

var gcsAdapter = new GCSAdapter(gcsOptions);

var api = new ParseServer({
	appId: 'my_app',
	masterKey: 'master_key',
	filesAdapter: gcsAdapter
})
```


