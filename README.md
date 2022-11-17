# feathers-s3

[![Latest Release](https://img.shields.io/github/v/tag/kalisio/feathers-s3?sort=semver&label=latest)](https://github.com/kalisio/feathers-s3/releases)
[![Build Status](https://app.travis-ci.com/kalisio/feathers-s3.svg?branch=master)](https://app.travis-ci.com/kalisio/feathers-s3)
[![Code Climate](https://codeclimate.com/github/kalisio/feathers-s3/badges/gpa.svg)](https://codeclimate.com/github/kalisio/feathers-s3)
[![Test Coverage](https://codeclimate.com/github/kalisio/feathers-s3/badges/coverage.svg)](https://codeclimate.com/github/kalisio/feathers-s3/coverage)
[![Download Status](https://img.shields.io/npm/dm/@kalisio/feathers-s3.svg?style=flat-square)](https://www.npmjs.com/package/@kalisio/feathers-s3)

> Manage s3 objects using presigned url

## Installation

```shell
npm install @kalisio/feathers-s3 --save
```

or

```shell
yarn add @kalisio/feathers-s3
```

## API

### Service

#### Service (options)

Create an instance of the service with the given options.

* `options.s3Client`: the s3Client configuration [required]
* `options.bucket`: the default bucket to use [optional as it can also be specified in request payload]
* `options.atob`: the ascii to binary function used to transform received data into a Buffer [optional as defaults is to transform from base64]

#### create (data, params)

Generate a presigned URL for the following commands:
* [PutObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/putobjectcommand.html)
* [GetObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/getobjectcommand.html)
* [UploadPartCommnad](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/uploadpartcommand.html)

The payload `data` must contain the following properties:

| Property | Description | Required |
|---|---|---|
| `command` | the command for which the presigned URL should be created. The possible values are `GetObject`, `PutObject` and `UploadPart`. | yes |
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `{u\|U}ploadId` | the **UploadId** generated when calling the [createMultipartUpload](#createmultipartupload-data-params) method. | yes if the command is `UploadPart` |
| `{p\|P}artNumber` | the **PartNumber** of the part to be uploaded. | yes if the command is `UploadPart` |

#### get (id, params)

Get an object from a bucket.

| Parameter | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |

#### remove (id, params)

Remove an object fromt the bucket.

| Parameter | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |

#### createMultipartUpload (data, params)

Initiate a multipart upload. 

It wraps the [CreateMultipartUploadCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/createmultipartuploadcommandoutput.html).

The payload `data` must contain the following properties:

| Property | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `type` | the content type to be uploaded. | yes |

Any optional properties are forwarded to the underlying `CreateMultipartUploadCommand` command parameters.

#### completeMultipartUpload (data, params)

Finalize a multipart upload. 

It wraps the [CompleteMultipartUploadCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/completemultipartuploadcommand.html).

The payload `data` must contain the following properties:

| Property | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `{u\|U}ploadId` | the **UploadId** generated when calling the [createMultipartUpload](#createmultipartupload-data-params) method. | yes |
| `parts` | the uploaded parts. It consists in an array of objects following the schema: `{ PartNumber: <number>, ETag: <etag> )}`. | yes |

Any optional properties are forwarded to the underlying `CompleteMultipartUploadCommand` command parameters.

#### uploadPart (data, params)

Upload a part to a bucket.

The payload `data` must contain the following properties:

| Property | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `{u\|U}ploadId` | the **UploadId** generated when calling the [createMultipartUpload](#createmultipartupload-data-params) method. | yes |
| `{p\|P}artNumber` | the part number. | yes |
| `buffer` | the content to be uploaded. | yes |
| `type` | the content type to be uploaded. | yes |

#### putObject (data, params)

Upload an object to a bucket.

The payload `data` must contain the following properties:

| Property | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `buffer` | the content to be uploaded. | yes |
| `type` | the content type to be uploaded. | yes |

### Client

#### getClientService (app, options)

Return the client service interface. The client service exposes the custom methods defined in the [Service](#service) and is also decorated with 2 helper functions that really simplify the logic when implementing a client application, notably for multipart upload.

| Parameters | Description | Required |
|---|---|---|
| `app` |  the **Feathers** client application | yes |
| `options` | the options to pass to the client service | no |

The options are:
| Options | Description | Default |
|---|---|---|
| `chunkSize` | the size of the chunk to perfom multipart upload | `5mb` |
| `useProxy` | define whether to use proxies custom methods | `false` |
| `btoa` | the binary to ascii function used to transform sent data into a string | transform to base64 |

#### upload (id, blob, options)

Upload a **Blob** object to the bucket with the given key `id`.

According the size of chunk you set when instanciang the client service and the size of the `blob`, the method will automatically perform a `singlepart` upload or a `mulitpart` upload.

If the `proxy` option is undefined. The client performs the upload action directly using **fetch**. Otherwise, it uses the [proxyUpload](#proxyupload) custom method.

| Parameters | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `blob` | the content of the object to be uploaded defined as a **Blob**. | yes |
| `options` | options to be forwarded to the underlying service methods. | no |

#### download (key, type, options)

Download an object from the bucket with the given key `id`.

If the `proxy` option is undefined. The client performs the download action directly using **fetch**. Otherwise, it uses the [getObject](#getObject) custom method.

| Parameters | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `type` | the type of the content to be downloaded. | yes |
| `options` | options to be forwarded to the underlying service methods. | no |