import _ from 'lodash'
import makeDebug from 'debug'
import fs from 'fs'
import fetch from 'node-fetch'

const debug = makeDebug('feathers-s3:client')

export class Client {
  constructor (clientApp, options) {
    this.service = clientApp.service(options.servicePath)
  }

  async upload (key, blob, options) {
    const data = _.merge({ id: key }, options)
    let response = await this.service.create(data)
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

  async download (key, type, options) {
    let response = await this.service.get(key, options)
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

  remove (key, options) {
    return this.service.remove(key, options)
  }
}
