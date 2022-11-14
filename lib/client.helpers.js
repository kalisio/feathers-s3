import _ from 'lodash'
import makeDebug from 'debug'
import fetch from 'node-fetch'

const debug = makeDebug('feathers-s3:client:helpers')

export class ClientHelpers {
  constructor (app, service) {
    this.app = app
    this.service = service
  }

  async upload (key, blob, options) {
    if (blob.size > this.service.chunkSize) {
      debug(`Multipart upload for file with key': ${key}`)
      return this.multipartUpload(key, blob, options)
    }
    debug(`Singlepart upload for file with key': ${key}`)
    return this.singlepartUpload(key, blob, options)
  }

  async multipartUpload (key, blob, options) {
    let offset = 0
    let partNumber = 0
    let uploadedParts = []
    // Create the multipart upload
    let response = await this.app.io.emit('createMultipartUpload', 's3', key, options)
    if (!response.id) return response
    const uploadId = response.id
    // Do the multipart upload
    while (offset < blob.size) {
      let chunk
      partNumber++
      if (offset + this.service.chunkSize <= blob.size) {
        chunk = blob.slice(offset, offset + this.service.chunkSize)
        offset += this.service.chunkSize
      } else {
        chunk = blob.slice(offset, blob.size)
        offset = blob.size
      }
      const response = await this.service.upload(key + '-part' + partNumber, chunk, {
        UploadId: uploadId,
        ...options
      })
      if (!response.ok) return response
      uploadedParts.push({ PartNumber: partNumber, Etag: response.Etag })
    }
    // Complete the multipart upload
    response = await this.app.io.emit('completeMultipartUpload', 's3', key, {
      UploadId: uploadId,
      MultipartUpload: {
        Parts: uploadedParts
      },
      ...options
    })
  }

  async singlepartUpload (key, blob, options) {
    if (blob.size > this.service.chunkSize) return this.uploadMultipart(key, blob, options)
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
}
