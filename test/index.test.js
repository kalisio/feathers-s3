
import { expect } from 'chai'
import { Service } from '../lib/index.js'
import fetch from 'node-fetch'
import fs from 'fs'

let options = {
  s3Client: {
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    },
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    signatureVersion: 'v4'
  },
  bucket: process.env.S3_BUCKET
}
let service

async function upload(filePath, contentType, signedUrl) {
  const fileSize = fs.statSync(filePath).size
  const fileStream = fs.createReadStream(filePath)
  return fetch(signedUrl, {
    method: 'PUT',
    body: fileStream,
    headers: {
      'Content-Type': contentType,
      'Content-Length': fileSize
    }
  })
}

describe('feathers-s3', () => {
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
  })
  it('create the service', () => {
    service = new Service(options)
    expect(service).to.exist
  })
  it('upload text file', async () => {
    const data = {
      id: 'feathers-s3/text.txt',
      expiresIn: 60
    }
    const { id, signedUrl } = await service.create(data)
    expect(signedUrl).to.exist
    const response = await upload('test/data/text.txt', 'text/plain', signedUrl)
    expect(response.status).to.equal(200)
  })
  it('upload image file', async () => {
    const data = {
      id: 'feathers-s3/image.png',
      expiresIn: 60
    }
    const { id, signedUrl } = await service.create(data)
    expect(signedUrl).to.exist
    const response = await upload('test/data/image.png', 'image/png', signedUrl)
    expect(response.status).to.equal(200)
  })
  it('upload zip file', async () => {
    const data = {
      id: 'feathers-s3/archive.zip',
      expiresIn: 60
    }
    const { id, signedUrl } = await service.create(data)
    expect(signedUrl).to.exist
    const response = await upload('test/data/archive.zip', 'application/zip', signedUrl)
    expect(response.status).to.equal(200)
  })
})
