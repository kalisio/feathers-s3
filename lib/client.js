import _ from 'lodash'
import makeDebug from 'debug'
import fs from 'fs'
import fetch from 'node-fetch'

const debug = makeDebug('feathers-s3:client')

export class Client {
  constructor (clientApp, options) {
    this.service = clientApp.service(options.servicePath)
  }

  async upload (key, filePath, mimeType, options) {
    const data = _.merge({ id: key }, options)
    const { status, signedUrl } = await this.service.create(data)
    if (status !== 200) return status
    debug(`signedUrl 'put' created with 'key': ${key}`)
    const fileSize = fs.statSync(filePath).size
    const fileStream = fs.createReadStream(filePath)
    try {
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: fileStream,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSize
        }
      })
      debug(`fetched file with key ${key}`)
      return response
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }

  async download (key, filePath, mimeType, options) {
    const { status, signedUrl } = await this.service.get(key, options)
    if (status !== 200) return status
    debug(`signedUrl 'get' created with 'key': ${key}`)
    try {
      const response = await fetch(signedUrl, {
        method: 'GET',
        headers: {
          'Content-Type': mimeType
        }
      })
      debug(`fetched file with key ${key}`)
      return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(filePath)
        response.body.pipe(fileStream)
        fileStream.on('close', () => resolve(response))
        fileStream.on('error', reject)
      })
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }

  remove (key, options) {
    return this.service.remove(key, options)
  }
}
