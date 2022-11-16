import _ from 'lodash'
import makeDebug from 'debug'
import fetch from 'node-fetch'

const debug = makeDebug('feathers-s3:client:helpers')

export class ClientHelpers {
  constructor (app, service, options) {
    this.app = app
    this.service = service
    this.proxy = _.get(options, 'useProxy', 'false') === true
  }

  async upload (id, blob, options) {
    if (blob.size > this.service.chunkSize) {
      debug(`multipart upload for file with 'id': ${id}`)
      return this.multipartUpload(id, blob, options)
    }
    debug(`singlepart upload for file with 'id': ${id}`)
    return this.singlepartUpload('PutObject', id, blob, options)
  }

  async multipartUpload (id, blob, options) {
    let offset = 0
    let partNumber = 0
    const parts = []
    // create the multipart upload
    debug(`create multipart upload with 'id': ${id}`)
    let response = await this.service.createMultipartUpload({ id })
    if (!response.ok) return response
    const uploadId = response.uploadId
    debug(`multipart upload created with 'uploadId': ${uploadId}`)
    // do the multipart upload
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
      debug(`upload part with number: ${partNumber} and uploadId: ${uploadId}`)
      const response = await this.singlepartUpload('UploadPart', id, chunk, {
        ...options,
        uploadId,
        partNumber
      })
      if (!response.ok) return response
      const etag = response.ETag
      debug(`part uploaded with ETag: ${etag}`)
      parts.push({ PartNumber: partNumber, ETag: etag })
    }
    // complete the multipart upload
    debug(`complete multipart upload with 'id': ${id} and uploadId: ${uploadId}`)
    response = await this.service.completeMultipartUpload({ id, uploadId, parts })
    if (!response.ok) return response
    return { ok: true, status: 200 }
  }

  async singlepartUpload (command, id, blob, options) {
    debug(`create singlepart upload with command: ${command} and 'id': ${id}`)
    if (this.proxy) {
      const buffer = await blob.arrayBuffer()
      const data = { id, buffer, type: blob.type, ...options }
      if (command === 'UploadPart') return await this.service.uploadPart(data)
      else return await this.service.putObject(data)
    }
    // create the signedUrl to upload the blob
    let response = await this.service.create({ command, id, ...options })
    if (!response.ok) return response
    const signedUrl = response.signedUrl
    // fetch the blob using the signedUrl
    try {
      response = await fetch(signedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Length': blob.size,
          'Content-Type': blob.type
        }
      })
      const etag = response.headers.raw().etag[0]
      return { ok: true, status: 200, ETag: etag }
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }

  async download (id, options) {
    if (this.proxy) {
      return this.service.get(id)
    }
    // create the signedUrl to download the blob
    let response = await this.service.create({ id, command: 'GetObject', ...options })
    if (!response.ok) return response
    const signedUrl = response.signedUrl
    try {
      response = await fetch(signedUrl, {
        method: 'GET'
      })
      const type = response.headers.raw()['content-type'][0]
      const buffer = await response.arrayBuffer()
      return { ok: true, status: 200, buffer, type }
    } catch (error) {
      return { status: 400, statusText: error }
    }
  }
}
