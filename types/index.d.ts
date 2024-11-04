import { Params, ServiceMethods, Application, NullableId, Query } from '@feathersjs/feathers';
import { S3Client, ListObjectsCommandOutput, GetObjectCommandOutput } from '@aws-sdk/client-s3';

// Configuration options for the S3 service
export interface S3Options {
  s3Client: {
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    endpoint: string;
    region: string;
    signatureVersion: string;
  };
  bucket: string;
  delimiter?: string;
  prefix?: string;
  id?: string;
  atob?: (data: string) => Buffer;
  btoa?: (data: ArrayBuffer) => string;
  getObjectPath?: string;
}

// Represents a file in S3
export interface S3File {
  Key: string;
  Location?: string;
  Bucket: string;
  ETag?: string;
}

// S3 Service class
export class Service implements ServiceMethods<any> {
  constructor(options: S3Options);
  update(id: NullableId, data: Partial<any>, params?: Params<Query> | undefined): Promise<any>;
  patch(id: NullableId, data: Partial<Partial<any>>, params?: Params<Query> | undefined): Promise<any>;
  setup?(app: Application, path: string): Promise<void>;
  teardown?(app: Application, path: string): Promise<void>;

  getKey(id: string): string;

  find(params?: Params): Promise<ListObjectsCommandOutput>;
  get(id: string, params?: Params): Promise<{ id: string; buffer: string; type: string }>;
  create(data: any, params?: Params): Promise<{ id: string; SignedUrl: string }>;
  remove(id: string, params?: Params): Promise<{ id: string }>;
  createMultipartUpload(data: any, params?: Params): Promise<{ id: string; UploadId: string }>;
  completeMultipartUpload(data: any, params?: Params): Promise<any>;
  uploadPart(data: any, params?: Params): Promise<any>;
  putObject(data: any, params?: Params): Promise<any>;
  getObjectCommand(data: any, params?: Params): Promise<GetObjectCommandOutput>;
  uploadFile(data: any, params?: Params): Promise<any>;
  downloadFile(data: any, params?: Params): Promise<any>;
}

// Client Helper for uploads and downloads
export class ClientHelpers {
  constructor(app: Application, service: Service, options: ClientOptions);

  upload(id: string, blob: Blob, options: any, params?: Params): Promise<any>;
  multipartUpload(id: string, blob: Blob, options: any, params?: Params): Promise<any>;
  singlepartUpload(command: string, id: string, blob: Blob, options: any, params?: Params): Promise<{ ETag: string }>;
  download(id: string, options: any, params?: Params): Promise<{ buffer: ArrayBuffer; type: string }>;
}

// Options for ClientHelpers
export interface ClientOptions {
  useProxy?: boolean;
  fetch?: (url: string, options: any) => Promise<Response>;
  atob?: (data: string) => ArrayBuffer;
  btoa?: (data: ArrayBuffer) => string;
  debug?: (message: string) => void;
}

// Helper functions for base64 encoding and decoding
export function base64Encode(bytes: Uint8Array): string;
export function base64Decode(encoded: string): ArrayBuffer;

// Middleware for handling S3 GetObject requests with range and proxy support
export function getObject(service: Service): (req: any, res: any) => Promise<void>;

// Function to retrieve client service
export function getClientService(app: Application, options: ClientOptions): Service;

// Extend the FeathersJS Application with S3 service
declare module '@feathersjs/feathers' {
  interface Application {
    use(path: string, service: Partial<Service>): this;
    service(path: string): Service;
  }
}
