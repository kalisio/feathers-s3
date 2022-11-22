import _ from 'lodash'
import createDebug from 'debug'
import { BadRequest } from '@feathersjs/errors'
import {
  S3Client, ListObjectsCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const debug = createDebug('feathers-s3:service')

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

function atob (data) {
  return Buffer.from(data, 'base64')
}
function btoa (data) {
  return Buffer.from(data).toString('base64')
}

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
    const signatureVersion = _.get(options.s3Client, 'signatureVersion')
    if (signatureVersion !== 'v4') {
      throw new Error('feathers-s3:constructor: `options.s3Client.signatureVersion` must be provided and equal to `v4`')
    }
    this.s3Client = new S3Client(options.s3Client)
    // Check for bucket
    if (!options.bucket) {
      throw new Error('feathers-s3:constructor: `options.bucket` must be provided')
    }
    this.bucket = options.bucket
    // Check for optional delimiter
    this.delimiter = options.delimiter || '/'
    // Check for optional prefix
    this.prefix = options.prefix
    // Handle bto/atob implementation
    this.atob = options.atob || atob
    this.btoa = options.btoa || btoa
    this.id = options.id || 'id'
  }

  getKey (id) {
    return this.prefix ? this.prefix + this.delimiter + id : id
  }

  async find (params) {
    // setup command params
    const commandParams = {
      ..._.mapKeys(params.query, (value, key) => { return _.upperFirst(key) }),
      Bucket: this.bucket
    }
    // take into account the service prefix
    if (this.prefix) {
      if (commandParams.Prefix) commandParams.Prefix = this.prefix + this.delimiter + commandParams.Prefix
      else commandParams.Prefix = this.prefix
    }
    // send command
    return this.s3Client.send(new ListObjectsCommand(commandParams))
  }

  async create (data, params) {
    // check payload
    if (!data.id) throw new BadRequest('create: missing \'data.id\' parameter')
    if (!data.command) throw new BadRequest('create: missing \'data.method\' parameter')
    debug(`method 'create' called with 'command': ${data.command} and 'id': ${data.id}`)
    // setup command params
    const commandParams = {
      ..._.omit(data, ['id']),
      Key: this.getKey(data.id),
      Bucket: this.bucket
    }
    // create the signed url using the expected command
    let command
    switch (data.command) {
      case 'PutObject':
        command = new PutObjectCommand(commandParams)
        break
      case 'GetObject':
        command = new GetObjectCommand(commandParams)
        break
      case 'UploadPart':
        if (!commandParams.UploadId) throw new BadRequest('create: missing \'data.UploadId\' parameter')
        if (!commandParams.PartNumber) throw new BadRequest('create: missing \'data.PartNumber\' parameter')
        command = new UploadPartCommand(commandParams)
        break
      default:
        throw new BadRequest(`create: invalid command ${data.command}`)
    }
    const SignedUrl = await getSignedUrl(this.s3Client, command, _.pick(data, signingOptions))
    return { [this.id]: data.id, SignedUrl }
  }

  async get (id, params) {
    // check id
    if (!id) throw new BadRequest('getObject: expected missing \'id\' parameter')
    debug(`method 'get' called with 'id': ${id}`)
    // setup command params
    const commandParams = {
      Key: this.getKey(id),
      Bucket: this.bucket
    }
    // send command
    const response = await this.s3Client.send(new GetObjectCommand(commandParams))
    // transform response
    const buffer = await response.Body.transformToString()
    // Need to convert array buffer to something serializable in JSON
    return { [this.id]: id, buffer: this.btoa(buffer), type: response.ContentType }
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
    const response = await this.s3Client.send(new DeleteObjectCommand(commandParams))
    return Object.assign({ [this.id]: id }, response)
  }

  async createMultipartUpload (data, params) {
    // check paylod
    if (!data.id) throw new BadRequest('createMultipartUpload: expected missing \'data.id\' parameter')
    if (!data.type) throw new BadRequest('createMultipartUpload: expected missing \'data.type\' parameter')
    debug(`method 'createMultipartUpload' called with 'data.id': ${data.id}`)
    // setup command params
    const commandParams = {
      ..._.mapKeys(_.omit(data, ['id']), (value, key) => { return _.upperFirst(key) }),
      Key: this.getKey(data.id),
      Bucket: this.bucket,
      ContentType: data.type
    }
    // Send command
    const response = await this.s3Client.send(new CreateMultipartUploadCommand(commandParams))
    return Object.assign({ [this.id]: data.id }, response)
  }

  async completeMultipartUpload (data, params) {
    // check paylod
    if (!data.id) throw new BadRequest('completeMultipartUpload: expected missing \'data.id\' parameter')
    if (!data.uploadId && !data.UploadId) throw new BadRequest('completeMultipartUpload: expected missing \'data.[U|u]ploadId\' parameter')
    if (!data.parts) throw new BadRequest('completeMultipartUpload: expected missing \'data.parts\' parameter')
    debug(`method 'completeMultipartUpload' called with 'data.id': ${data.id}`)
    // setup command params
    const commandParams = {
      ..._.mapKeys(_.omit(data, ['id', 'parts']), (value, key) => { return _.upperFirst(key) }),
      Key: this.getKey(data.id),
      Bucket: this.bucket,
      MultipartUpload: { Parts: data.parts }
    }
    // send command
    const response = await this.s3Client.send(new CompleteMultipartUploadCommand(commandParams))
    return Object.assign({ [this.id]: data.id }, response)
  }

  async uploadPart (data, params) {
    // check data object
    if (!data.id) throw new BadRequest('proxyUpload: expected missing \'data.id\' parameter')
    if (!data.UploadId && !data.UploadId) throw new BadRequest('proxyUpload: expected missing \'data.UploadId\' parameter')
    if (!data.PartNumber) throw new BadRequest('proxyUpload: expected missing \'data.PartNumber\' parameter')
    if (!data.buffer) throw new BadRequest('proxyUpload: expected missing \'data.buffer\' parameter')
    if (!data.type) throw new BadRequest('proxyUpload: expected missing \'data.type\' parameter')
    debug(`method 'uploadPart' called with 'data.id': ${data.id}`)
    // setup command params
    const commandParams = {
      ..._.mapKeys(_.omit(data, ['id', 'buffer']), (value, key) => { return _.upperFirst(key) }),
      Key: this.getKey(data.id),
      Bucket: this.bucket,
      Body: this.atob(data.buffer),
      ContentType: data.type
    }
    // send command
    const response = await this.s3Client.send(new UploadPartCommand(commandParams))
    return Object.assign({ [this.id]: data.id }, response)
  }

  async putObject (data, params) {
    // check data object
    if (!data.id) throw new BadRequest('proxyUpload: expected missing \'data.id\' parameter')
    if (!data.buffer) throw new BadRequest('proxyUpload: expected missing \'data.buffer\' parameter')
    if (!data.type) throw new BadRequest('proxyUpload: expected missing \'data.type\' parameter')
    debug(`method 'putObject' called with 'data.id': ${data.id}`)
    // setup command params
    const commandParams = {
      ..._.mapKeys(_.omit(data, ['id', 'buffer']), (value, key) => { return _.upperFirst(key) }),
      Key: this.getKey(data.id),
      Bucket: this.bucket,
      Body: this.atob(data.buffer),
      ContentType: data.type
    }
    // send command
    const response = await this.s3Client.send(new PutObjectCommand(commandParams))
    return Object.assign({ [this.id]: data.id }, response)
  }
}
