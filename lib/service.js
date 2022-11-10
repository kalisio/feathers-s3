import _ from 'lodash'
import path from 'path'
import makeDebug from 'debug'
import { BadRequest } from '@feathersjs/errors'
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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
      throw new Error('feathers-s3: constructor `s3Client` must be provided')
    }
    // Check s3Client configuration
    if (!options.s3Client) {
      throw new Error('feathers-s3: constructor `options.s3Client` must be provided')
    }
    this.s3Client = new S3Client(options.s3Client)
    // Check for optional default bucket
    this.bucket = options.bucket
    // Check for optional default prefix
    this.prefix = options.prefix
  }

  async createSignedUrl (command, options) {
    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, _.pick(options, signingOptions))
      debug(`Created signed url: ${signedUrl}`)
      return { ok: true, status: 200, signedUrl }
    } catch (error) {
      return { status: 'error', error }
    }
  }

  async create (data, params) {
    // Check data object
    if (!data.id) throw new BadRequest('get: missing \'id\' parameter')
    debug(`Method 'create' called with 'data.id': ${data.id}`)
    // Create the putCommand
    const putCommand = new PutObjectCommand({
      Key: this.prefix ? path.join(this.prefix, data.id) : data.id,
      Bucket: _.get(params, 'bucket', this.bucket)
    })
    // Run the command
    return await this.createSignedUrl(putCommand, data)
  }

  async get (id, params) {
    // Check id
    if (!id) throw new BadRequest('get: expected missing \'id\' parameter')
    debug(`Method 'get' called with 'id': ${id}`)
    // Create the getCommand
    const getCommand = new GetObjectCommand({
      Key: this.prefix ? path.join(this.prefix, id) : id,
      Bucket: _.get(params, 'bucket', this.bucket)
    })
    // Run the command
    return await this.createSignedUrl(getCommand, params)
  }

  async remove (id, params) {
    // Check id
    if (!id) throw new BadRequest('remove: expected missing \'id\' parameter')
    debug(`Method 'remove' called with 'id': ${id}`)
    // Create the deleteCommand
    const deleteCommand = new DeleteObjectCommand({
      Key: this.prefix ? path.join(this.prefix, id) : id,
      Bucket: _.get(params, 'bucket', this.bucket)
    })
    try {
      await this.s3Client.send(deleteCommand)
      return { ok: true, status: 200 }
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }
}
