# feathers-s3

[![Latest Release](https://img.shields.io/github/v/tag/kalisio/feathers-s3?sort=semver&label=latest)](https://github.com/kalisio/feathers-s3/releases)
[![Build Status](https://github.com/kalisio/feathers-s3/actions/workflows/main.yaml/badge.svg)](https://github.com/kalisio/feathers-s3/actions/workflows/main.yaml)
[![Code Climate](https://codeclimate.com/github/kalisio/feathers-s3/badges/gpa.svg)](https://codeclimate.com/github/kalisio/feathers-s3)
[![Test Coverage](https://codeclimate.com/github/kalisio/feathers-s3/badges/coverage.svg)](https://codeclimate.com/github/kalisio/feathers-s3/coverage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Download Status](https://img.shields.io/npm/dm/@kalisio/feathers-s3.svg?style=flat-square)](https://www.npmjs.com/package/@kalisio/feathers-s3)

> `feathers-s3` allows to deal with [AWS S3 API](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html) compatible storages to manage file upload/download in a FeathersJS application.

Unlike the solution [feathers-blob](https://github.com/feathersjs-ecosystem/feathers-blob), which provides a store abstraction, `feathers-s3` is limited to
be used with stores providing a S3 compatible API. However, it takes advantage of the **S3 API** by using [presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) to manage (upload, share) objects on a store in a more reliable and secure way.

Using **Presigned URL** has different pros and cons:

* Pros
  - It decreases the necessary resources of the server because the transfer process is established between the client and the S3 service.
  - It speeds up the transfer process because it can be easily parallelized.
  - It reduces the risk of your server becoming a bottleneck.
  - It supports multipart upload by design.
  - It is inherently secure.
* Cons
  - It involves extra complexity on the client side.
  - It requires your S3 bucket to have CORS enabled.
  - It requires your provider to support S3 Signature Version 4.
  - The access to the object is limited to a short time.

To address these drawbacks, `feathers-s3` provides:
* **Helper functions** to simplify usage from a client application.
* An [Express middleware](http://expressjs.com/en/guide/using-middleware.html) to directly access objects based on URLs without using **presignedl url**. There is no time constraint unlike with **presigned url** and you can also access only a portion of an object using [range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests).
* A **proxy** mode that let you use **service methods** that don't rely on **presigned URL** in case your S3 provider doesn't support CORS settings or you'd like to [process data](README.md#data-processing) on your backend. In this case the objects are always transferred through your backend.

## Principle

The following sections illustrate the different process implemented by `feathers-s3`:

### Upload

The `upload` process can be a **singlepart** upload or a **multipart** upload depending on the size of the object to be uploaded. If the size is greater than a `chunkSize` (by default 5MB), `feathers-s3` performs a **multipart** upload. Otherwise it performs a **singlepart** upload. 

#### Singlepart upload

![Upload principle](./docs/feathers-s3-upload.png)

#### Multipart upload

![Mulitpart upload principle](./docs/feathers-s3-multipart-upload.png)

### Download

![Donwload principle](./docs/feathers-s3-download.png)

## Usage

### Installation

```shell
npm install @kalisio/feathers-s3 --save
```

or

```shell
yarn add @kalisio/feathers-s3
```

### Example

The provided [example](./example/README.md) illustrates how to setup:

* a server app

https://github.com/kalisio/feathers-s3/blob/fa8adde8181ccad740ed7fcfb92af1a5c43f9281/example/app.mjs#L1-L44

* a browser client app

https://github.com/kalisio/feathers-s3/blob/184802600263e62b4d8d910d8781cbf3b7b03966/example/public/index.html#L1-L74

_As a general rule you can also have a look at the [tests](./test) in order to have different use cases of the library_.

### Data processing

Some use cases might require you directly process the data on your server before sending it to the object storage, e.g. if you'd like to resize an image. You can do that by:
1. registering a [before hook](https://feathersjs.com/api/hooks.html) on the `putObject` custom method to process the data before sending it to the object storage,
2. using the [proxy mode](README.md#client) on the client side service to send the data to your server instead of the object storage,
3. defining the appropriate [`chunkSize`](README.md#client) on the client service to not use multipart upload as processing usually requires the whole content to be sent.

Here is a simple example relying on [sharp](https://sharp.pixelplumbing.com/) to resize an image:
```js
async function resizeImage (hook) {
  hook.data.buffer = await sharp(hook.data.buffer)
    .resize(128, 48, { fit: 'contain', background: '#00000000' }).toBuffer()
}

app.service('s3').hooks({
  before: {
    putObject: [resizeImage]
  }
})

// Here you can proceed as usual from server side
service.putObject({ id, buffer, type })
// or client side
clientService.upload(id, blob, options)
```

## API

`feathers-s3` consists of three parts:
* [Service](#service) that provides basic methods for using **S3** API.
* [Middlewares](#middlewares) that provides an [Express middleware](http://expressjs.com/en/guide/using-middleware.html) to access an object from the store.
* [Client](#client) that provides helper functions to simplify the `upload` and `download` logic for the client side.

### Service

#### constructor (options)

Create an instance of the service with the given options:

| Parameter | Description | Required |
|---|---|---|
|`s3Client` | the s3Client [configuration](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/s3client.html#config). | yes |
| `bucket` |  the bucket to use. | yes |
| `prefix` | an optional prefix to use when computing the final **Key** | no |
| `btoa` | the binary to ascii function used to transform sent data into a string. Default is to transform to base64. | no |
| `atob` | the ascii to binary function used to transform received data into a Buffer. Default is to transform back from base64. | no |

#### find (params)

Lists some objects in a bucket according given criteria provided in the `params.query` object.

Check the [ListObjectsCommandInput](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/listobjectscommandinput.html) documentation to have the list of supported poperties.

#### create (data, params)

Generates a presigned URL for the following commands:
* [PutObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/putobjectcommand.html)
* [GetObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/getobjectcommand.html)
* [UploadPartCommnad](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/uploadpartcommand.html)

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `command` | the command for which the presigned URL should be created. The possible values are `GetObject`, `PutObject` and `UploadPart`. |
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |
| `UploadId` | the **UploadId** generated when calling the [createMultipartUpload](#createmultipartupload-data-params) method. It is required if the command is `UploadPart` |
| `PartNumber` | the **PartNumber** of the part to be uploaded. It is required  if the command is `UploadPart` |

#### get (id, params)

Get an object content from a bucket.

| Parameter | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |

> [!NOTE]
> The object will be entirely read and transferred to the client, for large files consider using presigned URLs instead.

#### remove (id, params)

Remove an object fromt the bucket.

| Parameter | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |

#### createMultipartUpload (data, params)

Initiate a multipart upload. 

It wraps the [CreateMultipartUploadCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/createmultipartuploadcommandoutput.html).

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |
| `type` | the content type to be uploaded. |

Any optional properties are forwarded to the underlying `CreateMultipartUploadCommand` command parameters.

#### completeMultipartUpload (data, params)

Finalize a multipart upload. 

It wraps the [CompleteMultipartUploadCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/completemultipartuploadcommand.html).

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |
| `UploadId` | the **UploadId** generated when calling the [createMultipartUpload](#createmultipartupload-data-params) method. |
| `parts` | the uploaded parts. It consists in an array of objects following the schema: `{ PartNumber: <number>, ETag: <etag> )}`. |

Any optional properties are forwarded to the underlying `CompleteMultipartUploadCommand` command parameters.

#### uploadPart (data, params)

Upload a part to a bucket.

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |
| `UploadId` | the **UploadId** generated when calling the [createMultipartUpload](#createmultipartupload-data-params) method. |
| `PartNumber` | the part number. |
| `buffer` | the content to be uploaded. |
| `type` | the content type to be uploaded. |

#### putObject (data, params)

Upload an object to a bucket.

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |
| `buffer` | the content to be uploaded. |
| `type` | the content type to be uploaded. |

#### getObjectCommand (data, params)

Execute the **GetObjectCommand** and returns the response.

> [!NOTE]
> This method is not declared on the client side.

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. |

#### uploadFile (data, params)

Convenient method to upload a file.

> [!NOTE]
> This method is not declared on the client side.

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `filePath` | the path to the file to be uploaded. The basename is used for computing the object key. |
| `contentType` | the content type of the file to be uploaded. |

> [!NOTE]
> You can also provide an `id` property to override the computed object key.

#### downloadFile (data, params)

Convenient method to download a file.

> [!NOTE]
> This method is not declared on the client side.

The payload `data` must contain the following properties:

| Property | Description |
|---|---|
| `ìd` | the file key. Note that the final computed **Key** takes into account the `prefix` option of the service. |
| `filePath` | the path to the downloaded file.|

### Middlewares

#### getObject (service)

It expect to be setup on a route path like `path/to/get/*` where the last parameter is the path to the object in the target bucket.
It is associated with an S3 service to use the same configuration (s3client, bucket, etc...).

| Argument | Description | Required |
|---|---|---|
| `service` | the service to be associated to this midlleware. | yes |

```js
// How to setup the route
app.get('/s3-objects/*', getObject(service))
// How to use it with any request agent like superagent
const response = await superagent.get('your.domain.com/s3-objects/my-file.png')
```

You can also simply use the target object URL in your HTML: `<img src="your.domain.com/s3-objects/my-file.png">`.

If you'd like to authenticate the route on your backend you will have to do something like this:
```js
import { authenticate } from '@feathersjs/express'

app.get('/s3-objects/*', authenticate('jwt'), getObject(service))
```

In this case, if you need to reference the object by the URL it will require you to add the JWT as a query parameter like this: `<img src="your.domain.com/s3-objects/my-file.png?jwt=TOKEN">`. The JWT can then be extracted by a middleware:
```js
import { authenticate } from '@feathersjs/express'

app.get('/s3-objects/*', (req, res, next) => {
  req.feathers.authentication = {
    strategy: 'jwt',
    accessToken: req.query.jwt
  }
  next()
}, authenticate('jwt'), getObject(service))
```

### Client

#### getClientService (app, options)

Return the client service interface. The client service exposes the custom methods defined in the [Service](#service) and is also decorated with 2 helper functions that really simplify the logic when implementing a client application, notably for multipart upload.

| Argument | Description |  Required |
|---|---|---|
| `app` |  the **Feathers** client application | yes |
| `options` | the options to pass to the client service | no |

The options are:

| Options | Description | Default |
|---|---|---|
| `transport` | the transport layer used by the **Feathers** client application. For now it is required. |
| `servicePath` | the path to the service. | `s3` |
| `chunkSize` | the size of the chunk to perfom multipart upload. | `5MB` |
| `useProxy` | define whether to use backend as a proxy for custom methods. | `false` |
| `fetch` | the fetch function. | browser fetch function |
| `btoa` | the binary to ascii function used to transform sent data into a string. | transform to base64 |
| `atob` | the ascii to binary function used to transform received data into a Buffer. | transform from base64 |
| `debug` | the debug function. | null |

#### upload (id, blob, options)

Upload a **Blob** object to the bucket with the given key `id`.

According the size of chunk you set when instanciang the client service and the size of the `blob`, the method will automatically perform a `singlepart` upload or a `mulitpart` upload.

If the `proxy` option is undefined. The client performs the upload action directly using **fetch**. Otherwise, it uses the [proxyUpload](#proxyupload) custom method.

| Argument | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `blob` | the content of the object to be uploaded defined as a **Blob**. | yes |
| `options` | options to be forwarded to the underlying service methods. | no |

#### download (key, type, options)

Download an object from the bucket with the given key `id`.

If the `proxy` option is undefined. The client performs the download action directly using **fetch**. Otherwise, it uses the [getObject](#getObject) custom method.

| Argument | Description | Required |
|---|---|---|
| `id` |  the object key. Note that the final computed **Key** takes into account the `prefix` option of the service. | yes |
| `type` | the type of the content to be downloaded. | yes |
| `options` | options to be forwarded to the underlying service methods. | no |

## License

Copyright (c) 2017-20xx Kalisio

Licensed under the [MIT license](LICENSE).

## Authors

This project is sponsored by 

[![Kalisio](https://s3.eu-central-1.amazonaws.com/kalisioscope/kalisio/kalisio-logo-black-256x84.png)](https://kalisio.com)
