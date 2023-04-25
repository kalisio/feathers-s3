import makeDebug from 'debug'
import feathers from '@feathersjs/feathers'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import sharp from 'sharp'
import express from '@feathersjs/express'
import fs from 'fs'
import { Service } from '../lib/index.js'

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

const fileId = 'image.png'
const fileContent = fs.readFileSync('test/data/image.png')
let resizedFileContent

async function resizeImage (hook) {
  resizedFileContent = await sharp(hook.data.buffer).resize(128, 48, { fit: 'contain', background: '#00000000' }).toBuffer()
  // Write the processed image for further testing
  await sharp(resizedFileContent).toFile('test/output/resized-image.png')
  hook.data.buffer = resizedFileContent
}

describe('feathers-s3-processing', () => {
  before(() => {
    chailint(chai, util)
    app = express(feathers())
    app.use(express.json())
    app.configure(express.rest())
  })
  it('configure the service', async () => {
    app.use('s3', new Service(options), {
      methods: ['create', 'get', 'find', 'remove', 'putObject']
    })
    service = app.service('s3')
    expect(service).toExist()
    // Add hook for processing
    service.hooks({
      before: {
        putObject: [resizeImage]
      }
    })
    expressServer = await app.listen(3333)
  })
  it('upload with processing', async () => {
    let eventReceived = false
    service.once('object-put', (data) => {
      if (data.id === fileId) eventReceived = true
    })
    const response = await service.putObject({
      id: fileId,
      buffer: fileContent,
      type: 'image/png'
    })
    expect(response.id).to.equal(fileId)
    expect(response.ETag).toExist()
    expect(eventReceived).beTrue()
  })
  it('download processed file', async () => {
    const response = await service.get(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.buffer).toExist()
    expect(response.type).to.equal('image/png')
    const buffer = service.atob(response.buffer)
    expect(buffer.toString()).to.equal(resizedFileContent.toString())
    // Write the downloaded image
    await sharp(buffer).toFile('test/output/downloaded-resized-image.png')
    // Ensure it is similar to what we expect
    const resizedImage = fs.readFileSync('test/output/resized-image.png')
    const downloadedImage = fs.readFileSync('test/output/downloaded-resized-image.png')
    expect(resizedImage.toString()).to.equal(downloadedImage.toString())
  })
  it('remove uploaded file', async () => {
    fs.unlinkSync('test/output/resized-image.png')
    fs.unlinkSync('test/output/downloaded-resized-image.png')
    const response = await service.remove(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  after(async () => {
    await expressServer.close()
  })
})
