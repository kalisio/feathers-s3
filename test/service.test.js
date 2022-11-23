import makeDebug from 'debug'
import feathers from '@feathersjs/feathers'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import superagent from 'superagent'
import express from '@feathersjs/express'
import fs from 'fs'
import { Blob } from 'buffer'
import { Service, getObject } from '../lib/index.js'

feathers.setDebug(makeDebug)

let app, service, expressServer

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
  prefix: 'feathers-s3-test-service'
}

const fileId = 'features.geojson'
const fileContent = fs.readFileSync('test/data/features.geojson')
const blob = new Blob([fileContent], { type: 'application/geo+json' })
const chunkSize = 1024 * 1024 * 5
let uploadId
const parts = []

describe('feathers-s3-service', () => {
  before(() => {
    chailint(chai, util)
    app = express(feathers())
    app.use(express.json())
    app.configure(express.rest())
  })
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
  })
  it('create the service', async () => {
    app.use('s3', new Service(options))
    service = app.service('s3')
    expect(service).toExist()
    app.get('/s3-objects/*', getObject(service))
    expressServer = await app.listen(3333)
  })
  it('createMultipartUpload', async () => {
    const response = await service.createMultipartUpload({ id: fileId, type: blob.type })
    expect(response.id).to.equal(fileId)
    expect(response.UploadId).toExist()
    uploadId = response.UploadId
  })
  it('uploadPart 1', async () => {
    const response = await service.uploadPart({
      id: fileId,
      buffer: await blob.slice(0, chunkSize).arrayBuffer(),
      type: blob.type,
      PartNumber: 1,
      UploadId: uploadId
    }, { expiresIn: 30 })
    expect(response.id).to.equal(fileId)
    expect(response.ETag).toExist()
    parts.push({ PartNumber: 1, ETag: response.ETag })
  })
  it('uploadPart 2', async () => {
    const response = await service.uploadPart({
      id: fileId,
      buffer: await blob.slice(chunkSize, blob.size).arrayBuffer(),
      type: blob.type,
      PartNumber: 2,
      UploadId: uploadId
    }, { expiresIn: 30 })
    expect(response.id).to.equal(fileId)
    expect(response.ETag).toExist()
    parts.push({ PartNumber: 2, ETag: response.ETag })
  })
  it('completeMultipartUpload', async () => {
    const response = await service.completeMultipartUpload({
      id: fileId,
      UploadId: uploadId,
      parts
    })
    expect(response.id).to.equal(fileId)
    expect(response.ETag).toExist()
    expect(response.VersionId).toExist()
    expect(response.Location).toExist()
  })
  it('list uploaded files', async () => {
    const response = await service.find()
    expect(response.Contents.length).to.equal(1)
    expect(response.Contents[0].Key).to.equal(options.prefix + '/' + fileId)
  })
  it('download file with middleware', async () => {
    const response = await superagent
      .get(`http://localhost:3333/s3-objects/${fileId}`)
    expect(response.text).to.equal(fileContent.toString())
  })
  it('download file with service method', async () => {
    const response = await service.get(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.buffer).toExist()
    expect(response.type).to.equal('application/geo+json')
    const buffer = service.atob(response.buffer)
    expect(buffer.toString()).to.equal(fileContent.toString())
  })
  it('remove uploaded file', async () => {
    const response = await service.remove(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  after(async () => {
    await expressServer.close()
  })
})
