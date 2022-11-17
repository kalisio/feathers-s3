import createDebug from 'debug'
import fetch from 'node-fetch'

const debug = createDebug('feathers-s3:client:helpers')

export class ClientHelpers {
  constructor (app, service, options) {
    this.app = app
    this.service = service
    this.proxy = options.useProxy
    this.atob = options.atob || atob
    this.btoa = options.btoa || btoa
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
    // check arguments
    if (!id) throw new Error('multipartUpload: \'id\' argument must be provided')
    if (!blob) throw new Error('multipartUpload: \'blob\' agrument must be provided')
    if (!blob.type) throw new Error('multipartUpload: \'blob.type\' property must be provided')
    debug(`multipartUpload called with 'id': ${id}`)
    // setup required variables
    let offset = 0
    let partNumber = 0
    const parts = []
    // initialize the multipart upload
    const { UploadId } = await this.service.createMultipartUpload({ id, type: blob.type })
    debug(`multipart upload created with 'UploadId': ${UploadId}`)
    // do the multipart upload
    while (offset < blob.size) {
      let chunk
      partNumber++
      if (offset + this.service.chunkSize <= blob.size) {
        chunk = blob.slice(offset, offset + this.service.chunkSize, blob.type)
        offset += this.service.chunkSize
      } else {
        chunk = blob.slice(offset, blob.size, blob.type)
        offset = blob.size
      }
      debug(`upload part with number: ${partNumber} and UploadId: ${UploadId}`)
      const { ETag } = await this.singlepartUpload('UploadPart', id, chunk, {
        ...options,
        UploadId,
        partNumber
      })
      parts.push({ PartNumber: partNumber, ETag })
    }
    // finalize the multipart upload
    debug(`complete multipart upload with UploadId: ${UploadId}`)
    return this.service.completeMultipartUpload({ id, UploadId, parts })
  }

  async singlepartUpload (command, id, blob, options) {
    // check arguments
    if (!command) throw new Error('singlepartUpload: \'command\' argument must be provided')
    if (!id) throw new Error('singlepartUpload: \'id\' argument must be provided')
    if (!blob) throw new Error('singlepartUpload: \'blob\' agrument must be provided')
    if (!blob.type) throw new Error('singlepartUpload: \'blob.type\' property must be provided')
    debug(`singlepartUpload called with 'command': ${command} and 'id': ${id}`)
    // handle proxy case if needed
    if (this.proxy) {
      debug('singlepartUpload uses proxy')
      let buffer = await blob.arrayBuffer()
      // Need to convert array buffer to something serializable in JSON
      buffer = this.btoa(buffer)
      const data = { id, buffer, type: blob.type, ...options }
      if (command === 'UploadPart') return await this.service.uploadPart(data)
      return await this.service.putObject(data)
    }
    // create the signedUrl to upload the blob
    const { SignedUrl } = await this.service.create({ command, id, ...options })
    debug(`singlepartUpload uses signedUrl ${SignedUrl}`)
    const response = await fetch(SignedUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Length': blob.size,
        'Content-Type': blob.type
      }
    })
    const etag = response.headers.raw().etag[0]
    debug(`singlepartUpload succeeded with ETag ${etag}`)
    return { ETag: etag }
  }

  async download (id, options) {
    // check arguments
    if (!id) throw new Error('download: \'id\' argument must be provided')
    debug(`download called with 'id': ${id}`)
    // handle proxy case if needed
    if (this.proxy) {
      debug('download uses proxy')
      const response = await this.service.get(id)
      response.buffer = this.atob(response.buffer)
      return response
    }
    // use a signedurl
    const { SignedUrl } = await this.service.create({ id, command: 'GetObject', ...options })
    debug(`download uses signedUrl ${SignedUrl}`)
    const response = await fetch(SignedUrl, {
      method: 'GET'
    })
    const type = response.headers.raw()['content-type'][0]
    const buffer = await response.arrayBuffer()
    debug('download succeeded')
    return { buffer, type }
  }
}
