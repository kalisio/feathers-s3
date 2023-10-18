// import createDebug from 'debug'
import { ClientHelpers } from './client-helpers.js'

export function getClientService (app, options) {
  const debug = (message) => {
    if (options.debug) options.debug(message)
  }
  // Check arguments
  if (!app) throw new Error('getClientService: missing \'app\'')
  if (!options.transport) throw new Error('getClientService: missing \'options.transport\'')
  // Get service path
  const servicePath = options.servicePath || 's3'
  // Define custom methods
  app.use(servicePath, options.transport.service(servicePath), {
    methods: ['create', 'get', 'remove', 'createMultipartUpload', 'completeMultipartUpload', 'uploadPart', 'putObject']
  })
  // Retrieve the service
  const service = app.service(servicePath)
  if (!service) {
    throw new Error('getClientService: `service` not found')
  }
  // Set the chunk size
  const minChunkSize = 1024 * 1024 * 5 // 5MB
  service.chunkSize = options.chunkSize || minChunkSize
  if (service.chunkSize < minChunkSize) {
    throw new Error('getClientService: `chunkSize` must be greater or equal to 5MB')
  }
  debug(`service chunkSize set to ${service.chunkSize}`)
  // Add helper functions
  const helpers = new ClientHelpers(app, service, options)
  service.upload = helpers.upload.bind(helpers)
  service.download = helpers.download.bind(helpers)
  debug('service decorated with \'upload\' and \'download\' methods')
  return service
}
