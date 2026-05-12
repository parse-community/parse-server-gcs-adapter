'use strict';
let filesAdapterTests = require('parse-server-conformance-tests').files;

let GCSAdapter = require('../index.js');

describe('GCSAdapter tests', () => {

  it('should throw when not initialized properly', () => {
    expect(() => {
      return new GCSAdapter();
    }).toThrowError('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter('projectId');
    }).toThrowError('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter('projectId', 'keyFilename');
    }).toThrowError('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId' });
    }).toThrowError('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId', keyFilename: 'keyFilename' });
    }).toThrowError('GCSAdapter requires an bucket');
  });

  it('should not throw when initialized properly', () => {
    expect(() => {
      return new GCSAdapter('projectId', 'keyFilename', 'bucket');
    }).not.toThrow();

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId', keyFilename: 'keyFilename', bucket: 'bucket' });
    }).not.toThrow();
  });

  it('should keep the default export for transpiled imports', () => {
    expect(GCSAdapter.default).toBe(GCSAdapter);
  });

  describe('environment options', () => {
    let directAccess;
    let bucketPrefix;

    beforeEach(() => {
      directAccess = process.env.GCS_DIRECT_ACCESS;
      bucketPrefix = process.env.GCS_BUCKET_PREFIX;
    });

    afterEach(() => {
      if (directAccess === undefined) {
        delete process.env.GCS_DIRECT_ACCESS;
      } else {
        process.env.GCS_DIRECT_ACCESS = directAccess;
      }

      if (bucketPrefix === undefined) {
        delete process.env.GCS_BUCKET_PREFIX;
      } else {
        process.env.GCS_BUCKET_PREFIX = bucketPrefix;
      }
    });

    it('should parse GCS_DIRECT_ACCESS as a boolean', () => {
      process.env.GCS_DIRECT_ACCESS = 'false';
      let proxiedAdapter = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket'
      });

      expect(proxiedAdapter.getFileLocation({
        mount: '/parse',
        applicationId: 'appId'
      }, 'folder/file name.txt')).toBe('/parse/files/appId/folder%2Ffile%20name.txt');

      process.env.GCS_DIRECT_ACCESS = 'true';
      let directAdapter = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket',
        bucketPrefix: 'prefix/'
      });

      expect(directAdapter.getFileLocation({
        mount: '/parse',
        applicationId: 'appId'
      }, 'folder/file name.txt')).toBe('https://storage.googleapis.com/bucket/prefix/folder/file%20name.txt');
    });

    it('should preserve an explicit empty bucketPrefix over the environment', () => {
      process.env.GCS_BUCKET_PREFIX = 'env-prefix/';
      let adapter = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket',
        bucketPrefix: '',
        directAccess: true
      });

      expect(adapter.getFileLocation({
        mount: '/parse',
        applicationId: 'appId'
      }, 'folder/file name.txt')).toBe('https://storage.googleapis.com/bucket/folder/file%20name.txt');
    });
  });

  describe('input validation', () => {
    let gcsAdapter;

    beforeEach(() => {
      gcsAdapter = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket'
      });
    });

    it('should reject relative object paths', (done) => {
      expect(() => {
        gcsAdapter.getFileLocation({
          mount: '/parse',
          applicationId: 'appId'
        }, '../secret.txt');
      }).toThrowError('GCSAdapter filename cannot contain relative path segments');

      gcsAdapter.deleteFile('folder/../secret.txt')
        .then(() => {
          fail('Promise should have rejected');
          done();
        })
        .catch((err) => {
          expect(err.message).toBe('GCSAdapter filename cannot contain relative path segments');
          done();
        });
    });

    it('should reject unsafe content types before uploading', (done) => {
      gcsAdapter.createFile('safe.txt', 'data', 'text/plain\r\nx-bad: yes')
        .then(() => {
          fail('Promise should have rejected');
          done();
        })
        .catch((err) => {
          expect(err.message).toBe('GCSAdapter contentType cannot contain line breaks');
          done();
        });
    });

    it('should reject missing files with an Error when GCS returns no error', (done) => {
      let mockExists = jasmine.createSpy('exists');
      let mockFile = { exists: mockExists };
      let mockBucket = jasmine.createSpyObj('bucket', ['file']);
      mockBucket.file.and.returnValue(mockFile);
      let mockStorage = jasmine.createSpyObj('storage', ['bucket']);
      mockStorage.bucket.and.returnValue(mockBucket);
      gcsAdapter._gcsClient = mockStorage;

      mockExists.and.callFake((callback) => {
        callback(null, false);
      });

      gcsAdapter.getFileData('missing.txt')
        .then(() => {
          fail('Promise should have rejected');
          done();
        })
        .catch((err) => {
          expect(err instanceof Error).toBe(true);
          expect(err.message).toBe('File missing.txt does not exist.');
          done();
        });
    });
  });

  describe('deleteFile', () => {
    let gcsAdapter;
    let mockStorage;
    let mockBucket;
    let mockFile;
    let mockDelete;

    beforeEach(() => {
      mockDelete = jasmine.createSpy('delete');
      mockFile = { delete: mockDelete };
      mockBucket = jasmine.createSpyObj('bucket', ['file']);
      mockBucket.file.and.returnValue(mockFile);
      mockStorage = jasmine.createSpyObj('storage', ['bucket']);
      mockStorage.bucket.and.returnValue(mockBucket);

      gcsAdapter = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket',
        bucketPrefix: 'prefix/'
      });
      gcsAdapter._gcsClient = mockStorage;
    });

    it('should call delete on the prefixed file and resolve with response', (done) => {
      mockDelete.and.callFake((callback) => {
        callback(null, { statusCode: 204 });
      });

      let result = gcsAdapter.deleteFile('my-file.txt');
      expect(result && typeof result.then).toBe('function');
      expect(result && typeof result.catch).toBe('function');

      result.then((response) => {
        expect(mockStorage.bucket).toHaveBeenCalledWith('bucket');
        expect(mockBucket.file).toHaveBeenCalledWith('prefix/my-file.txt');
        expect(mockDelete).toHaveBeenCalled();
        expect(response.statusCode).toBe(204);
        done();
      }).catch((err) => {
        fail('Promise should not reject: ' + err);
        done();
      });
    });

    it('should reject when delete returns an error', (done) => {
      let error = new Error('delete failed');
      error.code = 403;
      mockDelete.and.callFake((callback) => {
        callback(error);
      });

      gcsAdapter.deleteFile('my-file.txt')
        .then(() => {
          fail('Promise should have rejected');
          done();
        })
        .catch((err) => {
          expect(err).toBe(error);
          expect(err.code).toBe(403);
          expect(mockStorage.bucket).toHaveBeenCalledWith('bucket');
          expect(mockBucket.file).toHaveBeenCalledWith('prefix/my-file.txt');
          expect(mockDelete).toHaveBeenCalled();
          done();
        });
    });

    it('should use filename as-is when bucketPrefix is empty', (done) => {
      let adapterWithoutPrefix = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket'
      });
      adapterWithoutPrefix._gcsClient = mockStorage;

      mockDelete.and.callFake((callback) => {
        callback(null, {});
      });

      adapterWithoutPrefix.deleteFile('plain-file.txt')
        .then(() => {
          expect(mockBucket.file).toHaveBeenCalledWith('plain-file.txt');
          done();
        })
        .catch((err) => {
          fail('Promise should not reject: ' + err);
          done();
        });
    });
  });

  if (process.env.GCP_PROJECT_ID && process.env.GCP_KEYFILE_PATH && process.env.GCS_BUCKET) {
    // Should be initialized from the env
    let gcsAdapter = new GCSAdapter();
    filesAdapterTests.testAdapter("GCSAdapter", gcs);
  }

});
