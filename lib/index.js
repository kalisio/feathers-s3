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
    const signedUrl = await getSignedUrl(this.s3Client, putCommand, options)
    debug(`Created 'put' signed url: ${signedUrl}`)
    return {
      id: data.id,
      signedUrl
    }
  }

  async get (id, data) {
    // Check id
    if (!id) throw new BadRequest('get: expected missing \'id\' parameter')
    debug(`Method 'get' called with 'id': ${id}`)
    // Create the getCommand
    const getCommand = new GetObjectCommand({
      Key: data.id,
      Bucket: data.bucket || this.bucket
    })
    // Run the command
    const options = _.pick(data, signingOptions)
    const signedUrl = await getSignedUrl(this.s3Client, getCommand, options)
    debug(`created 'get' signed url: ${signedUrl}`)
    return {
      id,
      signedUrl
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
    // Run the command
    const options = _.pick(params, signingOptions)
    const signedUrl = await getSignedUrl(this.s3Client, deleteCommand, options)
    debug(`created 'delete' signed url: ${signedUrl}`)
    return {
      id,
      signedUrl
    }
  }
}
