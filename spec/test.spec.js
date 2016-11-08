'use strict';
let filesAdapterTests = require('parse-server-conformance-tests').files;

let GCSAdapter = require('../index.js');

describe('GCSAdapter tests', () => {

  it('should throw when not initialized properly', () => {
    expect(() => {
      return new GCSAdapter();
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter('projectId');
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter('projectId', 'keyFilename');
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId'});
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId' , keyFilename: 'keyFilename'});
    }).toThrow('GCSAdapter requires an bucket');
  });

  it('should not throw when initialized properly', () => {
    expect(() => {
      return new GCSAdapter('projectId', 'keyFilename', 'bucket');
    }).not.toThrow();

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId' , keyFilename: 'keyFilename', bucket: 'bucket'});
    }).not.toThrow();
  });

  if (process.env.GCP_PROJECT_ID && process.env.GCP_KEYFILE_PATH && process.env.GCS_BUCKET) {
    // Should be initialized from the env
    let gcsAdapter = new GCSAdapter();
    filesAdapterTests.testAdapter("GCSAdapter", gcs);
  }

});
