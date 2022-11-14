import _ from 'lodash'
import makeDebug from 'debug'
import { BadRequest } from '@feathersjs/errors'
import {
  S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const debug = makeDebug('feathers-s3:service')

// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/interfaces/_aws_sdk_types.requestpresigningarguments-1.html
const signingOptions = [
  'expiresIn',
  'signableHeaders',
  'signingDate',
  'signingRegion',
  'signingService',
  'unhoistableHeaders',
  'unsignableHeaders'
]

export class Service {
  constructor (options) {
    // Check options
    if (!options) {
      throw new Error('feathers-s3:constructor: `options` must be provided')
    }
    // Check s3Client configuration
    if (!options.s3Client) {
      throw new Error('feathers-s3:constructor: `options.s3Client` must be provided')
    }
    this.s3Client = new S3Client(options.s3Client)
    // Check for bucket
    if (!options.bucket) {
      throw new Error('feathers-s3:constructor: `options.bucket` must be provided')
    }
    this.bucket = options.bucket
    // Check for optional default prefix
    this.prefix = options.prefix
  }

  getKey (id) {
    return this.prefix ? this.prefix + '/' + id : id
  }

  async createSignedUrl (command, options) {
    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, _.pick(options, signingOptions))
      debug(`created signed url: ${signedUrl}`)
      return { ok: true, status: 200, signedUrl }
    } catch (error) {
      return { status: 'error', error }
    }
  }

  async create (data, params) {
    // Check data object
    if (!data.id) throw new BadRequest('get: missing \'data.id\' parameter')
    debug(`method 'create' called with 'data.id': ${data.id}`)
    // Setup command params
    const commandParams = {
      ..._.mapKeys(_.omit(data, ['id']), (value, key) => { return _.upperFirst(key) }),
      Key: this.getKey(data.id),
      Bucket: this.bucket
    }
    if (!commandParams.UploadId && !commandParams.PartNumber) {
      debug('S3 command \'PutObjectCommand\' called with createSignedUrl')
      return this.createSignedUrl(new PutObjectCommand(commandParams), params)
    }
    // Ensure required paramaters for multipart upload are set
    if (!commandParams.UploadId) throw new BadRequest('get: missing \'data.uploadId\' parameter')
    if (!commandParams.PartNumber) throw new BadRequest('get: missing \'data.partNumber\' parameter')
    debug('S3 command \'UploadPartCommand\' called with createSignedUrl')
    // Send command
    return this.createSignedUrl(new UploadPartCommand(commandParams), params)
  }

  async get (id, params) {
    // Check id
    if (!id) throw new BadRequest('get: expected missing \'id\' parameter')
    debug(`method 'get' called with 'id': ${id}`)
    // Setup command params
    const commandParams = {
      Key: this.getKey(id),
      Bucket: this.bucket
    }
    // Send command
    return this.createSignedUrl(new GetObjectCommand(commandParams), params)
  }

  async remove (id, params) {
    // Check id
    if (!id) throw new BadRequest('remove: expected missing \'id\' parameter')
    debug(`method 'remove' called with 'id': ${id}`)
    // Setup command params
    const commandParams = {
      Key: this.getKey(id),
      Bucket: this.bucket
    }
    // send command
    try {
      await this.s3Client.send(new DeleteObjectCommand(commandParams))
      return { ok: true, status: 200 }
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }

  async createMultipartUpload (data, params) {
    // Check id
    if (!data.id) throw new BadRequest('createMultipartUpload: expected missing \'data.id\' parameter')
    // Setup command params
    const commandParams = {
      ..._.mapKeys(_.omit(data, ['id']), (value, key) => { return _.upperFirst(key) }),
      Key: this.getKey(data.id),
      Bucket: this.bucket
    }
    // Send command
    try {
      const { UploadId } = await this.s3Client.send(new CreateMultipartUploadCommand(commandParams))
      return { ok: true, status: 200, uploadId: UploadId }
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }

  async completeMultipartUpload (data, params) {
    // Check id
    if (!data.id) throw new BadRequest('completeMultipartUpload: expected missing \'data.id\' parameter')
    if (!data.uploadId && !data.UploadId) throw new BadRequest('completeMultipartUpload: expected missing \'data.[U|u]ploadId\' parameter')
    if (!data.parts) throw new BadRequest('completeMultipartUpload: expected missing \'data.parts\' parameter')
    // Setup command params
    const commandParams = {
      ..._.mapKeys(_.omit(data, ['id', 'parts']), (value, key) => { return _.upperFirst(key) }),
      Key: this.getKey(data.id),
      Bucket: this.bucket,
      MultipartUpload: { Parts: data.parts }
    }
    // Send command
    try {
      await this.s3Client.send(new CompleteMultipartUploadCommand(commandParams), params)
      return { ok: true, status: 200 }
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }
}
