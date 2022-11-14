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
      debug(`multipart upload for file with key': ${key}`)
      return this.multipartUpload(key, blob, options)
    }
    debug(`singlepart upload for file with key': ${key}`)
    return this.singlepartUpload(key, blob, options)
  }

  async multipartUpload (key, blob, options) {
    let offset = 0
    let partNumber = 0
    const parts = []
    // Create the multipart upload
    debug(`create multipart upload with 'key': ${key}`)
    let response = await this.service.createMultipartUpload({ id: key })
    if (!response.ok) return response
    const uploadId = response.uploadId
    debug(`multipart upload created with 'uploadId': ${uploadId}`)
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
      debug(`upload part with number: ${partNumber}`)
      const response = await this.service.upload(key, chunk, {
        ...options,
        uploadId,
        partNumber
      })
      if (!response.ok) return response
      const etag = response.headers.raw().etag[0]
      debug(`part uploaded with ETag: ${etag}`)
      parts.push({ PartNumber: partNumber, ETag: etag })
    }
    // Complete the multipart upload
    debug(`complete multipart upload with 'key': ${key}`)
    response = await this.service.completeMultipartUpload({
      id: key,
      uploadId,
      parts
    })
    if (!response.ok) return response
    return { ok: true, status: 200 }
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
