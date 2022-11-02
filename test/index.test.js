
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { Service } from '../lib/index.js'
import fetch from 'node-fetch'
import fs from 'fs'

const options = {
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

const prefix = 'feathers-s3'
const textFileId = prefix + '/text.txt'
const imageFileId = prefix + '/image.png'
const archiveFileId = prefix + '/arvhive.zip'

// Upload helper function
async function upload (signedUrl, mimeType, filePath) {
  const fileSize = fs.statSync(filePath).size
  const fileStream = fs.createReadStream(filePath)
  return fetch(signedUrl, {
    method: 'PUT',
    body: fileStream,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileSize
    }
  })
}

// Download helper function
async function download (signedUrl, mimeType, filePath) {
  const response = await fetch(signedUrl, {
    method: 'GET',
    headers: {
      'Content-Type': mimeType
    }
  })
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filePath)
    response.body.pipe(fileStream)
    fileStream.on('close', () => resolve(200))
    fileStream.on('error', reject)
  })
}

describe('feathers-s3', () => {
  before(() => {
    chailint(chai, util)
  })
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
  })
  it('create the service', () => {
    service = new Service(options)
    expect(service).toExist()
  })
  it('upload text file', async () => {
    const data = {
      id: textFileId,
      expiresIn: 60
    }
    const { signedUrl } = await service.create(data)
    expect(signedUrl).toExist()
    const response = await upload(signedUrl, 'text/plain', 'test/data/text.txt')
    expect(response.status).to.equal(200)
  })
  it('upload image file', async () => {
    const data = {
      id: imageFileId,
      expiresIn: 60
    }
    const { signedUrl } = await service.create(data)
    expect(signedUrl).toExist()
    const response = await upload(signedUrl, 'image/png', 'test/data/image.png')
    expect(response.status).to.equal(200)
  })
  it('upload zip file', async () => {
    const data = {
      id: archiveFileId,
      expiresIn: 60
    }
    const { signedUrl } = await service.create(data)
    expect(signedUrl).toExist()
    const response = await upload(signedUrl, 'application/zip', 'test/data/archive.zip')
    expect(response.status).to.equal(200)
  })
  it('download text file', async () => {
    const filePath = 'test/data/downloaded-text.txt'
    const { status, signedUrl } = await service.get(textFileId, { expiresIn: 60 })
    expect(status).to.equal('ok')
    expect(signedUrl).toExist()
    const response = await download(signedUrl, 'text/plain', filePath)
    expect(response).to.equal(200)
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('download image file', async () => {
    const filePath = 'test/data/downloaded-image.png'
    const { status, signedUrl } = await service.get(imageFileId, { expiresIn: 60 })
    expect(status).to.equal('ok')
    expect(signedUrl).toExist()
    const response = await download(signedUrl, 'image/png', filePath)
    expect(response).to.equal(200)
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('download archive file', async () => {
    const filePath = 'test/data/downloaded-archive.zip'
    const { status, signedUrl } = await service.get(archiveFileId, { expiresIn: 60 })
    expect(status).to.equal('ok')
    expect(signedUrl).toExist()
    const response = await download(signedUrl, 'application/zip', filePath)
    expect(response).to.equal(200)
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('delete text file', async () => {
    const { status } = await service.remove(textFileId, { expiresIn: 60 })
    expect(status).to.equal('ok')
  })
  it('delete image file', async () => {
    const { status } = await service.remove(imageFileId, { expiresIn: 60 })
    expect(status).to.equal('ok')
  })
  it('delete archive file', async () => {
    const { status } = await service.remove(archiveFileId, { expiresIn: 60 })
    expect(status).to.equal('ok')
  })
})
