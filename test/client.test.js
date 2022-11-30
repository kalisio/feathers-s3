import createDebug from 'debug'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import superagent from 'superagent'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import feathersClient from '@feathersjs/client'
import feathersSocketio from '@feathersjs/socketio'
import io from 'socket.io-client'
import { Service, getClientService } from '../lib/index.js'
import fs from 'fs'
import { Blob } from 'buffer'
import fetch from 'node-fetch'

const { rest } = express

feathers.setDebug(createDebug)
feathersClient.setDebug(createDebug)

const debugClient = createDebug('feathers-s3:client')

let serverApp, expressServer, socket, transport, clientApp, s3Service, s3ClientService

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
  prefix: 'feathers-s3-test-client'
}

const textFileId = 'text.txt'
const imageFileId = 'image.png'
const archiveFileId = 'archive.zip'
const featuresFileId = 'features.geojson'

const textFileContent = fs.readFileSync('test/data/text.txt')
const imageFileContent = fs.readFileSync('test/data/image.png')
const archiveFileContent = fs.readFileSync('test/data/archive.zip')
const featuresFileContent = fs.readFileSync('test/data/features.geojson')

let useProxy = false

function runTests (message, checkEvents) {
  it('create s3 service' + message, () => {
    s3ClientService = getClientService(clientApp, {
      servicePath: 's3',
      transport,
      useProxy,
      fetch,
      debug: debugClient
    })
    expect(s3ClientService).toExist()
    expect(s3ClientService.createMultipartUpload).toExist()
    expect(s3ClientService.completeMultipartUpload).toExist()
    expect(s3ClientService.uploadPart).toExist()
    expect(s3ClientService.putObject).toExist()
    expect(s3ClientService.upload).toExist()
    expect(s3ClientService.download).toExist()
  })
  it('upload text file' + message, async () => {
    const blob = new Blob([textFileContent], { type: 'text/plain' })
    let eventReceived = false
    if (checkEvents) s3ClientService.once(useProxy ? 'object-put' : 'created', (data) => {
      if (data.id === textFileId) eventReceived = true
    })
    const response = await s3ClientService.upload(textFileId, blob, { expiresIn: 30 })
    expect(response.ETag).toExist()
    if (checkEvents) expect(eventReceived).beTrue()
  })
  it('upload image file' + message, async () => {
    const blob = new Blob([imageFileContent], { type: 'image/png' })
    let eventReceived = false
    if (checkEvents) s3ClientService.once(useProxy ? 'object-put' : 'created', (data) => {
      if (data.id === imageFileId) eventReceived = true
    })
    const response = await s3ClientService.upload(imageFileId, blob, { expiresIn: 30 })
    expect(response.ETag).toExist()
    if (checkEvents) expect(eventReceived).beTrue()
  })
  it('upload zip file' + message, async () => {
    const blob = new Blob([archiveFileContent], { type: 'application/zip' })
    let eventReceived = false
    if (checkEvents) s3ClientService.once(useProxy ? 'object-put' : 'created', (data) => {
      if (data.id === archiveFileId) eventReceived = true
    })
    const response = await s3ClientService.upload(archiveFileId, blob, { expiresIn: 30 })
    expect(response.ETag).toExist()
    if (checkEvents) expect(eventReceived).beTrue()
  })
  it('upload features file' + message, async () => {
    const blob = new Blob([featuresFileContent], { type: 'application/geo+json' })
    let eventsReceived = 0
    if (checkEvents) {
      s3ClientService.once('multipart-upload-created', (data) => {
        if (data.id === featuresFileId) eventsReceived++
      })
      s3ClientService.once(useProxy ? 'part-uploaded' : 'created', (data) => {
        if (data.id === featuresFileId) {
          eventsReceived++
          s3ClientService.once(useProxy ? 'part-uploaded' : 'created', (data) => {
            if (data.id === featuresFileId) eventsReceived++
          })
        }
      })
      s3ClientService.once('multipart-upload-completed', (data) => {
        if (data.id === featuresFileId) eventsReceived++
      })
    }
    const response = await s3ClientService.upload(featuresFileId, blob, { expiresIn: 30 })
    expect(response.ETag).toExist()
    if (checkEvents) expect(eventsReceived).to.equal(4)
  })
  it('list uploaded files', async () => {
    const response = await s3ClientService.find()
    expect(response.Contents.length).to.equal(4)
  })
  it('download text file' + message, async () => {
    const response = await s3ClientService.download(textFileId, { expiresIn: 30 })
    expect(response.type).to.equal('text/plain')
    expect(response.buffer).toExist()
    expect(Buffer.from(response.buffer).toString()).to.equal(textFileContent.toString())
  })
  it('download image file' + message, async () => {
    const response = await s3ClientService.download(imageFileId, { expiresIn: 30 })
    expect(response.type).to.equal('image/png')
    expect(response.buffer).toExist()
    expect(Buffer.from(response.buffer).toString()).to.equal(imageFileContent.toString())
  })
  it('download zip file' + message, async () => {
    const response = await s3ClientService.download(archiveFileId, { expiresIn: 30 })
    expect(response.type).to.equal('application/zip')
    expect(response.buffer).toExist()
    expect(Buffer.from(response.buffer).toString()).to.equal(archiveFileContent.toString())
  })
  it('download features file' + message, async () => {
    const response = await s3ClientService.download(featuresFileId, { expiresIn: 30 })
    expect(response.type).to.equal('application/geo+json')
    expect(response.buffer).toExist()
    expect(Buffer.from(response.buffer).toString()).to.equal(featuresFileContent.toString())
  })
  it('delete text file' + message, async () => {
    const response = await s3ClientService.remove(textFileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  it('delete image file' + message, async () => {
    const response = await s3ClientService.remove(imageFileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  it('delete archive file' + message, async () => {
    const response = await s3ClientService.remove(archiveFileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  it('change proxy mode', () => {
    useProxy = !useProxy
  })
}

describe('feathers-s3-client', () => {
  before(async () => {
    chailint(chai, util)
    serverApp = express(feathers())
    // With proxy we need to extend limits as we are transferring object/part to our server
    serverApp.use(express.json({ limit: 100 * 1024 * 1024 }))
    serverApp.use(express.urlencoded({ extended: true }))
    serverApp.configure(rest())
    serverApp.configure(feathersSocketio({ maxHttpBufferSize: 1e8 }))
    expressServer = await serverApp.listen(3333)
  })
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
    expect(typeof getClientService).to.equal('function')
  })
  it('create s3 service', () => {
    serverApp.use('s3', new Service(options), {
      methods: ['create', 'get', 'find', 'remove', 'createMultipartUpload', 'completeMultipartUpload', 'uploadPart', 'putObject'],
      events: ['multipart-upload-created', 'multipart-upload-completed', 'part-uploaded', 'object-put']
    })
    // Setup a channel to publish all events
    serverApp.on('connection', connection => serverApp.channel('anonymous').join(connection))
    serverApp.publish((data, context) => serverApp.channel('anonymous'))
    s3Service = serverApp.service('s3')
    expect(s3Service).toExist()
  })
  it('create REST client', () => {
    clientApp = feathersClient()
    transport = feathersClient.rest('http://localhost:3333').superagent(superagent)
    clientApp.configure(transport)
  })
  runTests(' with REST client and without proxy', false)
  runTests(' with REST client and with proxy', false)
  it('create websocket client', () => {
    clientApp = feathersClient()
    socket = io('http://localhost:3333')
    transport = feathersClient.socketio(socket)
    clientApp.configure(transport)
  })
  runTests(' with websocket client and without proxy', true)
  runTests(' with websocket client and with proxy', true)
  after(async () => {
    await expressServer.close()
  })
})
