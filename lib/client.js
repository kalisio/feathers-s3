import _ from 'lodash'
import makeDebug from 'debug'
import { ClientHelpers } from './client.helpers.js'

const debug = makeDebug('feathers-s3:client')

export function getClientService (app, options) {
  // Check arguments
  if (!app) {
    throw new Error('feathers-s3:getClientService: `app` agrument must be provided')
  }
  // Get service path
  const servicePath = _.get(options, 'servicePath', 's3')
  const service = app.service(servicePath, { 
    methods: ['create', 'get', 'remove', 'createMultipartUpload', 'completeMultipartUpload']
  })
  if (!service) {
    throw new Error('feathers-s3:getClientService: `service` not found')
  }
  // Set the chunk size
  const minChunkSize = 1024 * 1024 * 5 // 5MB
  service.chunkSize = _.get(options, 'chunkSize', minChunkSize)
  if (service.chunkSize < minChunkSize) {
    throw new Error('feathers-s3:getClientService: `chunkSize` must be greater or equal to 5MB')
  }
  debug(`Service chunkSize set to ${service.chunkSize}`)
  // Add helper functions
  const helpers = new ClientHelpers(app, service)
  service.upload = async (key, type, options) => { return helpers.upload(key, type, options) }
  service.download = async (key, type, options) => { return helpers.download(key, type, options) }
  debug('Service decorated with \'upload\' and \'download\' methods')
  // Define custom methods
  app.use(servicePath, service, {
    methods: ['create', 'get', 'remove', 'createMultipartUpload', 'completeMultipartUpload']
  })
  debug('Service expose standard methods as well as \'createMultipartUpload\' and \'completeMultipartUpload\' methods')
  return service
}
