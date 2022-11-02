import makeDebug from 'debug'
import _ from 'lodash'
import { BadRequest } from '@feathersjs/errors'
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const debug = makeDebug('feathers-s3')

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
    // Check optional default bucket
    this.bucket = options.bucket
  }

  async create (data, params) {
    // Check data object
    if (!data.id) throw new BadRequest('get: missing \'id\' parameter')
    debug(`Method 'create' called with 'data.id': ${data.id}`)
    // Create the putCommand
    const putCommand = new PutObjectCommand({
      Key: data.id,
      Bucket: data.bucket || this.bucket
    })
    // Run the command
    const options = _.pick(data, signingOptions)
    try {
      const signedUrl = await getSignedUrl(this.s3Client, putCommand, options)
      debug(`Created 'put' signed url: ${signedUrl}`)
      return { status: 'ok', signedUrl }
    } catch (error) {
      return { status: 'error', error }
    }
  }

  async get (id, data) {
    // Check id
    if (!id) throw new BadRequest('get: expected missing \'id\' parameter')
    debug(`Method 'get' called with 'id': ${id}`)
    // Create the getCommand
    const getCommand = new GetObjectCommand({
      Key: id,
      Bucket: data.bucket || this.bucket
    })
    // Run the command
    const options = _.pick(data, signingOptions)
    try {
      const signedUrl = await getSignedUrl(this.s3Client, getCommand, options)
      debug(`created 'get' signed url: ${signedUrl}`)
      return { status: 'ok', signedUrl }
    } catch (error) {
      return { status: 'error', error }
    }
  }

  async remove (id, params) {
    // Check id
    if (!id) throw new BadRequest('remove: expected missing \'id\' parameter')
    debug(`Method 'remove' called with 'id': ${id}`)
    // Create the deleteCommand
    const deleteCommand = new DeleteObjectCommand({
      Key: id,
      Bucket: params.bucket || this.bucket
    })
    try {
      await this.s3Client.send(deleteCommand)
      return { status: 'ok' }
    } catch (error) {
      return { status: 'error', error }
    }
  }
}
