import _ from 'lodash'
import makeDebug from 'debug'
import fetch from 'node-fetch'

const debug = makeDebug('feathers-s3:client')

async function upload (key, blob, options) {
  const data = _.merge({ id: key }, options)
  let response = await this.create(data)
  if (!response.ok) return response
  debug(`signedUrl 'PUT' created with 'key': ${key}`)
  try {
    response = await fetch(response.signedUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Length': blob.size,
        'Content-Type': blob.type
      }
    })
    debug(`fetched file with key ${key}`)
    return response
  } catch (error) {
    return { status: 400, statusText: error }
  }
}

async function download (key, type, options) {
  let response = await this.get(key, options)
  if (!response.ok) return response
  debug(`signedUrl 'GET' created with 'key': ${key}`)
  try {
    response = await fetch(response.signedUrl, {
      method: 'GET',
      headers: {
        'Content-Type': type
      }
    })
    debug(`fetched file with key ${key}`)
    return response
  } catch (error) {
    return { status: 400, statusText: error }
  }
}

export function getClientService (app, options) {
  // Check arguments
  if (!app) {
    throw new Error('feathers-s3:getClientService: `app` agrument must be provided')
  }
  // Get service path
  const servicePath = _.get(options, 'servicePath', 's3')
  const service = app.service(servicePath)
  if (!service) {
    throw new Error('feathers-s3:getClientService: `service` not found')
  }
  // Add helper functions
  service.upload = upload.bind(service)
  service.download = download.bind(service)
  return service
}
