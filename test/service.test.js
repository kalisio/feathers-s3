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
const filePath = 'test/data/features.geojson'
const tmpFilePath = 'test/tmp/features.geojson'
const fileType = 'application/geo+json'
const fileContent = fs.readFileSync(filePath)
const blob = new Blob([fileContent], { type: fileType })
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
    app.use('s3', new Service(options), {
      methods: [
        'create', 'get', 'find', 'remove', 'createMultipartUpload', 'completeMultipartUpload',
        'uploadPart', 'putObject', 'uploadFile', 'downloadFile'
      ]
    })
    service = app.service('s3')
    expect(service).toExist()
    app.get('/s3-objects/*', getObject(service))
    expressServer = await app.listen(3333)
  })
  it('createMultipartUpload', async () => {
    let eventReceived = false
    service.once('multipart-upload-created', (data) => {
      if (data.id === fileId) eventReceived = true
    })
    const response = await service.createMultipartUpload({ id: fileId, type: blob.type })
    expect(response.id).to.equal(fileId)
    expect(response.UploadId).toExist()
    uploadId = response.UploadId
    expect(eventReceived).beTrue()
  })
  it('uploadPart 1', async () => {
    let eventReceived = false
    service.once('part-uploaded', (data) => {
      if (data.id === fileId) eventReceived = true
    })
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
    expect(eventReceived).beTrue()
  })
  it('uploadPart 2', async () => {
    let eventReceived = false
    service.once('part-uploaded', (data) => {
      if (data.id === fileId) eventReceived = true
    })
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
    expect(eventReceived).beTrue()
  })
  it('completeMultipartUpload', async () => {
    let eventReceived = false
    service.once('multipart-upload-completed', (data) => {
      if (data.id === fileId) eventReceived = true
    })
    const response = await service.completeMultipartUpload({
      id: fileId,
      UploadId: uploadId,
      parts
    })
    expect(response.id).to.equal(fileId)
    expect(response.ETag).toExist()
    expect(response.Location).toExist()
    expect(eventReceived).beTrue()
  })
  it('list remote objects', async () => {
    const response = await service.find()
    expect(response.length).to.equal(1)
    expect(response[0].Key).to.equal(fileId)
  })
  it('download object with middleware', async () => {
    const response = await superagent
      .get(`http://localhost:3333/s3-objects/${fileId}`)
    expect(response.text).to.equal(fileContent.toString())
  })
  it('download object with service method', async () => {
    const response = await service.get(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.buffer).toExist()
    expect(response.type).to.equal('application/geo+json')
    const buffer = service.atob(response.buffer)
    expect(buffer.toString()).to.equal(fileContent.toString())
  })
  it('remove remote object', async () => {
    const response = await service.remove(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  it('upload file', async () => {
    // uplaod file
    const response = await service.uploadFile({ filePath, mimeType: fileType })
    expect(response.id).to.equal(fileId)
    expect(response.Key).to.equal('feathers-s3-test-service/features.geojson')
    expect(response.ETag).toExist()
  })
  it('list remote files', async () => {
    const response = await service.find()
    expect(response.length).to.equal(1)
    expect(response[0].Key).to.equal(fileId)
  })
  it('get signed url to download file', async () => {
    const response = await service.create({ id: fileId, command: 'GetObject' })
    expect(response.SignedUrl).toExist()
  })
  it('download file', async () => {
    await service.downloadFile({ id: fileId, filePath: tmpFilePath })
    expect(fs.statSync(filePath).size).to.equal(6868192)
  })
  it('remove remote and loca files', async () => {
    const response = await service.remove(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
    fs.unlinkSync(tmpFilePath)
  })
  it('check remote is empty', async () => {
    const response = await service.find()
    expect(response.length).to.equal(0)
  })
  after(async () => {
    await expressServer.close()
  })
})
