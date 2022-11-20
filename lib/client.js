import createDebug from 'debug'
import { ClientHelpers } from './client-helpers.js'

const debug = createDebug('feathers-s3:client')

export function getClientService (app, options) {
  // Check arguments
  if (!app) {
    throw new Error('getClientService: `app` agrument must be provided')
  }
  if (!options.transport) {
    throw new Error('getClientService: `options.transport` agrument must be provided')
  }
  // Get service path
  const servicePath = options.servicePath || 's3'
  // Define custom methods
  app.use(servicePath, options.transport.service(servicePath), {
    methods: ['create', 'get', 'remove', 'createMultipartUpload', 'completeMultipartUpload', 'uploadPart', 'putObject']
  })
  // Retrieve the service
  const service = app.service(servicePath)
  if (!service) {
    throw new Error('feathers-s3:getClientService: `service` not found')
  }
  // Set the chunk size
  const minChunkSize = 1024 * 1024 * 5 // 5MB
  service.chunkSize = options.chunkSize || minChunkSize
  if (service.chunkSize < minChunkSize) {
    throw new Error('feathers-s3:getClientService: `chunkSize` must be greater or equal to 5MB')
  }
  debug(`service chunkSize set to ${service.chunkSize}`)
  // Add helper functions
  const helpers = new ClientHelpers(app, service, options)
  service.upload = async (key, type, options) => { return helpers.upload(key, type, options) }
  service.download = async (key, type, options) => { return helpers.download(key, type, options) }
  debug('service decorated with \'upload\' and \'download\' methods')
  return service
}
