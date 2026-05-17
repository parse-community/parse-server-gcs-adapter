'use strict';
let filesAdapterTests = require('parse-server-conformance-tests').files;
let fs = require('fs');
let path = require('path');

let GCSAdapter = require('../dist/index.js');

describe('GCSAdapter tests', () => {

  it('should throw when not initialized properly', () => {
    expect(() => {
      return new GCSAdapter();
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter('projectId');
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter('projectId', 'keyFilename');
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId' });
    }).toThrow('GCSAdapter requires an bucket');

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId', keyFilename: 'keyFilename' });
    }).toThrow('GCSAdapter requires an bucket');
  });

  it('should not throw when initialized properly', () => {
    expect(() => {
      return new GCSAdapter('projectId', 'keyFilename', 'bucket');
    }).not.toThrow();

    expect(() => {
      return new GCSAdapter({ projectId: 'projectId', keyFilename: 'keyFilename', bucket: 'bucket' });
    }).not.toThrow();
  });

  describe('package entrypoints', () => {
    it('publishes compiled JavaScript and TypeScript declarations', () => {
      let packageJson = require('../package.json');

      expect(packageJson.main).toBe('dist/index.js');
      expect(packageJson.types).toBe('dist/index.d.ts');
      if (packageJson.main) {
        expect(fs.existsSync(path.join(__dirname, '..', packageJson.main))).toBe(true);
      }
      if (packageJson.types) {
        expect(fs.existsSync(path.join(__dirname, '..', packageJson.types))).toBe(true);
      }
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

  describe('directAccess', () => {
    let previousDirectAccess;

    beforeEach(() => {
      previousDirectAccess = process.env.GCS_DIRECT_ACCESS;
    });

    afterEach(() => {
      if (previousDirectAccess === undefined) {
        delete process.env.GCS_DIRECT_ACCESS;
      } else {
        process.env.GCS_DIRECT_ACCESS = previousDirectAccess;
      }
    });

    it('should treat GCS_DIRECT_ACCESS=false as disabled', () => {
      process.env.GCS_DIRECT_ACCESS = 'false';

      let gcsAdapter = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket',
        bucketPrefix: 'prefix/'
      });

      expect(gcsAdapter.getFileLocation({
        mount: '/parse',
        applicationId: 'app'
      }, 'my file.txt')).toBe('/parse/files/app/my%20file.txt');
    });

    it('should prefer an explicit directAccess option over GCS_DIRECT_ACCESS', () => {
      process.env.GCS_DIRECT_ACCESS = 'true';

      let gcsAdapter = new GCSAdapter({
        projectId: 'projectId',
        keyFilename: 'keyFilename',
        bucket: 'bucket',
        bucketPrefix: 'prefix/',
        directAccess: false
      });

      expect(gcsAdapter.getFileLocation({
        mount: '/parse',
        applicationId: 'app'
      }, 'my file.txt')).toBe('/parse/files/app/my%20file.txt');
    });
  });

  describe('getFileData', () => {
    let gcsAdapter;
    let mockStorage;
    let mockBucket;
    let mockFile;
    let mockExists;
    let mockDownload;

    beforeEach(() => {
      mockExists = jasmine.createSpy('exists');
      mockDownload = jasmine.createSpy('download');
      mockFile = {
        exists: mockExists,
        download: mockDownload
      };
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

    it('should resolve undefined when the file does not exist', (done) => {
      mockExists.and.callFake((callback) => {
        callback(null, false);
      });

      gcsAdapter.getFileData('missing.txt')
        .then((data) => {
          expect(data).toBeUndefined();
          expect(mockStorage.bucket).toHaveBeenCalledWith('bucket');
          expect(mockBucket.file).toHaveBeenCalledWith('prefix/missing.txt');
          expect(mockDownload).not.toHaveBeenCalled();
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
