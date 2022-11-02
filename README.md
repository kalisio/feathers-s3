# feathers-s3
Manage s3 objects using presigned url

## Installation

```shell
npm install @kalisio/feathers-s3 --save
```

or

```shell
yarn add @kalisio/feathers-s3
```

## API

### Service (options)

Create an instance of the service with the given options.

* `options.s3Client`: the s3Client configuration [required]
* `options.bucket`: the default bucket to use [optional]

### create (data, params)

Generate a presigned URL to `PUT` an object in the S3 bucket

* `data.id`: the object key [required]
* `params.bucket`: a different bucket than the default one [optional]

### get (id, data)

Generate a presigned URL to `GET` an object from the S3 bucket

* `id`: the object key [required]
* `params.bucket`: a different bucket than the default one [optional]

### remove (id, params)

Remove an object from the S3 bucket.

* `id`: the object key [required]
* `params.bucket`: a different bucket than the default one [optional]