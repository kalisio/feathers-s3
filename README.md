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