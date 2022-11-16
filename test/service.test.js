
import makeDebug from 'debug'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import feathers from '@feathersjs/feathers'
import configuration from '@feathersjs/configuration'
import fs from 'fs'
import { Blob } from 'buffer'
import { Service } from '../lib/index.js'

feathers.setDebug(makeDebug)

let app, service

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
  bucket: process.env.S3_BUCKET,
  prefix: 'feathers-s3'
}

const fileId = 'features.geojson'
const blob = new Blob([fs.readFileSync('test/data/features.geojson')], { type: 'application/geo+json' })
const chunkSize = 1024 * 1024 * 5
let uploadId
const parts = []

describe('feathers-s3-service', () => {
  before(() => {
    chailint(chai, util)
    app = feathers()
    app.configure(configuration())
  })
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
  })
  it('create the service', () => {
    app.use('s3', new Service(options))
    service = app.service('s3')
    expect(service).toExist()
  })
  it('createMultipartUpload', async () => {
    const response = await service.createMultipartUpload({ id: fileId })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.uploadId).toExist()
    uploadId = response.uploadId
  })
  it('uploadPart 1', async () => {
    const response = await service.uploadPart({
      id: fileId,
      command: 'UploadPart',
      buffer: await blob.slice(0, chunkSize).arrayBuffer(),
      type: 'application/geo+json',
      partNumber: 1,
      uploadId
    }, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.ETag).toExist()
    parts.push({ PartNumber: 1, ETag: response.ETag })
  })
  it('uploadPart 2', async () => {
    const response = await service.uploadPart({
      id: fileId,
      command: 'UploadPart',
      buffer: await blob.slice(chunkSize, blob.size).arrayBuffer(),
      type: 'application/geo+json',
      partNumber: 2,
      uploadId
    }, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.ETag).toExist()
    parts.push({ PartNumber: 2, ETag: response.ETag })
  })
  it('completeMultipartUpload', async () => {
    const response = await service.completeMultipartUpload({
      id: fileId,
      uploadId,
      parts
    })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
  it('Download file', async () => {
    const response = await service.get(fileId, { expisresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    const downloadedFile = 'test/data/dl-featues.geojson'
    fs.writeFileSync(downloadedFile, response.buffer)
    expect(fs.existsSync(downloadedFile)).beTrue()
    fs.unlinkSync(downloadedFile)
  })
  it('remove uploaded file', async () => {
    const response = await service.remove(fileId)
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
})
