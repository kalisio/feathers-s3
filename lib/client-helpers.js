// Taken from https://github.com/juanelas/base64
export const base64Encode = function (bytes) {
  bytes = new Uint8Array(bytes)
  const CHUNK_SIZE = 0x8000
  const array = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    array.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE)))
  }
  return btoa(array.join(''))
}

export const base64Decode = function (encoded) {
  return new Uint8Array(
    atob(encoded)
      .split('')
      .map((c) => c.charCodeAt(0))
  ).buffer
}

export class ClientHelpers {
  constructor (app, service, options) {
    this.app = app
    this.service = service
    this.proxy = options.useProxy
    this.atob = options.atob || base64Decode
    this.btoa = options.btoa || base64Encode
    this.fetch = options.fetch
    this.debug = (message) => {
      if (options.debug) options.debug(message)
    }
  }

  async upload (id, blob, options, params = {}) {
    if (blob.size > this.service.chunkSize) {
      this.debug(`multipart upload for file with 'id': ${id}`)
      return this.multipartUpload(id, blob, options, params)
    }
    this.debug(`singlepart upload for file with 'id': ${id}`)
    return this.singlepartUpload('PutObject', id, blob, options, params)
  }

  async multipartUpload (id, blob, options, params = {}) {
    // check arguments
    if (!id) throw new Error('multipartUpload: \'id\' argument must be provided')
    if (!blob) throw new Error('multipartUpload: \'blob\' agrument must be provided')
    if (!blob.type) throw new Error('multipartUpload: \'blob.type\' property must be provided')
    this.debug(`multipartUpload called with 'id': ${id}`)
    // setup required variables
    let offset = 0
    let PartNumber = 0
    const parts = []
    // initialize the multipart upload
    const { UploadId } = await this.service.createMultipartUpload({ id, type: blob.type }, params)
    this.debug(`multipart upload created with 'UploadId': ${UploadId}`)
    // do the multipart upload
    while (offset < blob.size) {
      let chunk
      PartNumber++
      if (offset + this.service.chunkSize <= blob.size) {
        chunk = blob.slice(offset, offset + this.service.chunkSize, blob.type)
        offset += this.service.chunkSize
      } else {
        chunk = blob.slice(offset, blob.size, blob.type)
        offset = blob.size
      }
      this.debug(`upload part with number: ${PartNumber} and UploadId: ${UploadId}`)
      const { ETag } = await this.singlepartUpload('UploadPart', id, chunk, {
        ...options,
        UploadId,
        PartNumber
      }, params)
      parts.push({ PartNumber, ETag })
    }
    // finalize the multipart upload
    this.debug(`complete multipart upload with UploadId: ${UploadId}`)
    return this.service.completeMultipartUpload({ id, UploadId, parts }, params)
  }

  async singlepartUpload (command, id, blob, options, params = {}) {
    // check arguments
    if (!command) throw new Error('singlepartUpload: \'command\' argument must be provided')
    if (!id) throw new Error('singlepartUpload: \'id\' argument must be provided')
    if (!blob) throw new Error('singlepartUpload: \'blob\' agrument must be provided')
    if (!blob.type) throw new Error('singlepartUpload: \'blob.type\' property must be provided')
    this.debug(`singlepartUpload called with 'command': ${command} and 'id': ${id}`)
    // handle proxy case if needed
    if (this.proxy) {
      this.debug('singlepartUpload uses proxy')
      let buffer = await blob.arrayBuffer()
      // Need to convert array buffer to something serializable in JSON
      buffer = this.btoa(buffer)
      const data = { id, buffer, type: blob.type, ...options }
      if (command === 'UploadPart') return await this.service.uploadPart(data, params)
      return await this.service.putObject(data, params)
    }
    // create the signedUrl to upload the blob
    const { SignedUrl } = await this.service.create({ command, id, ...options }, params)
    this.debug(`singlepartUpload uses signedUrl ${SignedUrl}`)
    const response = await this.fetch(SignedUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Length': blob.size,
        'Content-Type': blob.type
      }
    })
    const etag = response.headers.raw().etag[0]
    this.debug(`singlepartUpload succeeded with ETag ${etag}`)
    return { ETag: etag }
  }

  async download (id, options, params = {}) {
    // check arguments
    if (!id) throw new Error('download: \'id\' argument must be provided')
    this.debug(`download called with 'id': ${id}`)
    // handle proxy case if needed
    if (this.proxy) {
      this.debug('download uses proxy')
      const response = await this.service.get(id, params)
      response.buffer = this.atob(response.buffer)
      return response
    }
    // use a signedurl
    const { SignedUrl } = await this.service.create({ id, command: 'GetObject', ...options }, params)
    this.debug(`download uses signedUrl ${SignedUrl}`)
    const response = await this.fetch(SignedUrl, {
      method: 'GET'
    })
    const type = response.headers.raw()['content-type'][0]
    const buffer = await response.arrayBuffer()
    this.debug('download succeeded')
    return { buffer, type }
  }
}
