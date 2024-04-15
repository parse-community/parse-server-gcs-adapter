var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// index.ts
import { Storage } from "@google-cloud/storage";
function optionsFromArguments(args) {
  const defaultOptions = {
    projectId: process.env["GCP_PROJECT_ID"],
    keyFilename: process.env["GCP_KEYFILE_PATH"],
    bucket: process.env["GCS_BUCKET"],
    bucketPrefix: process.env["GCS_BUCKET_PREFIX"] || "",
    directAccess: process.env["GCS_DIRECT_ACCESS"] === "true" ? true : false
  };
  return __spreadValues(__spreadValues({}, defaultOptions), args[0]);
}
var GCSAdapter = class {
  constructor(...args) {
    let options = optionsFromArguments(args);
    this._bucket = options.bucket;
    this._bucketPrefix = options.bucketPrefix || "";
    this._directAccess = options.directAccess || false;
    this._baseUrl = options.baseUrl || "https://storage.googleapis.com/";
    this._gcsClient = new Storage(options);
  }
  createFile(filename, data, contentType) {
    return __async(this, null, function* () {
      const params = {
        metadata: {
          contentType: contentType || "application/octet-stream"
        }
      };
      const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
      yield new Promise((resolve, reject) => {
        const uploadStream = file.createWriteStream(params);
        uploadStream.on("error", reject);
        uploadStream.on("finish", resolve);
        uploadStream.end(data);
      });
      if (this._directAccess) {
        yield file.makePublic().catch((err) => {
          throw new Error(`Error making file public: ${err}`);
        });
      }
    });
  }
  deleteFile(filename) {
    return __async(this, null, function* () {
      try {
        const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
        yield file.delete();
      } catch (err) {
        throw new Error(`Error deleting file ${filename}: ${err}`);
      }
    });
  }
  getFileData(filename) {
    return __async(this, null, function* () {
      try {
        const file = this._gcsClient.bucket(this._bucket).file(this._bucketPrefix + filename);
        const [exists] = yield file.exists();
        if (!exists) {
          throw new Error(`File ${filename} does not exist.`);
        }
        const [data] = yield file.download();
        return data;
      } catch (err) {
        throw new Error(`Error downloading file ${filename}: ${err}`);
      }
    });
  }
  getFileLocation(config, filename) {
    if (this._directAccess) {
      return `${this._baseUrl}${this._bucket}/${this._bucketPrefix + filename}`;
    }
    return `${config.mount}/files/${config.applicationId}/${encodeURIComponent(filename)}`;
  }
};
var parse_gcs_default = GCSAdapter;
export {
  parse_gcs_default as default
};
//# sourceMappingURL=index.mjs.map