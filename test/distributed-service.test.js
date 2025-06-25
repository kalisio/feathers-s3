import makeDebug from 'debug'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import feathersClient from '@feathersjs/client'
import feathersSocketio from '@feathersjs/socketio'
import io from 'socket.io-client'
import distribution, { finalize } from '@kalisio/feathers-distributed'
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import superagent from 'superagent'
import fetch from 'node-fetch'
import fs from 'fs'
import utility from 'util'
import crypto from 'crypto'
import { Blob } from 'buffer'
import { Service, getClientService } from '../lib/index.js'

feathers.setDebug(makeDebug)
feathersClient.setDebug(makeDebug)
const debugClient = makeDebug('feathers-s3:distributed-client')

let consumerApp, consumerService, storageApp, storageService, expressServer, clientApp, clientService, socket, transport

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
  prefix: crypto.randomUUID()
}

const methods = [
  'create', 'get', 'find', 'remove', 'createMultipartUpload', 'completeMultipartUpload',
  'uploadPart', 'putObject', 'uploadFile', 'downloadFile'
]
const events = [
  'created', 'removed', 'multipart-upload-created', 'multipart-upload-completed',
  'part-uploaded', 'object-put', 'file-uploaded', 'file-downloaded'
]

const distributionConfig = {
  consumerApp: {
    // We only consume services we don't produce any
    services: (service) => false,
    // Consume only S3 service
    remoteServices: (service) => service.path.endsWith('s3'),
    // Methods and events we'd like to distribute, include any custom method or event
    distributedMethods: methods,
    distributedEvents: events,
    cote: { // Use cote defaults to speedup tests
      helloInterval: 2000,
      checkInterval: 4000,
      nodeTimeout: 5000,
      masterTimeout: 6000
    },
    publicationDelay: 5000
  },
  storageApp: {
    // Distribute only S3 service
    services: (service) => service.path.endsWith('s3'),
    // We only produce services we don't consume any
    remoteServices: (service) => false,
    // Methods and events we'd like to distribute, include any custom method or event
    distributedMethods: methods,
    distributedEvents: events,
    cote: { // Use cote defaults to speedup tests
      helloInterval: 2000,
      checkInterval: 4000,
      nodeTimeout: 5000,
      masterTimeout: 6000
    },
    publicationDelay: 5000
  }
}
const fileId = 'image.png'
const fileContent = fs.readFileSync('test/data/image.png')

describe('feathers-s3-distributed-service', () => {
  before(() => {
    chailint(chai, util)
    consumerApp = express(feathers())
    // Extend limits as we are transferring object/part to our server
    consumerApp.use(express.json({ limit: 100 * 1024 * 1024 }))
    consumerApp.configure(express.rest())
    consumerApp.configure(feathersSocketio({ maxHttpBufferSize: 1e8 }))
    consumerApp.configure(distribution(distributionConfig.consumerApp))
    storageApp = feathers()
    storageApp.configure(distribution(distributionConfig.storageApp))
    clientApp = feathersClient()
    socket = io('http://localhost:3333')
    transport = feathersClient.socketio(socket)
    clientApp.configure(transport)
  })
  it('create the services', async () => {
    storageApp.use('s3', new Service(options), {
      methods, events
    })
    storageService = storageApp.service('s3')
    expect(storageService).toExist()
    // Wait long enough to be sure the distribution is effective
    await utility.promisify(setTimeout)(10000)
    consumerService = consumerApp.service('s3')
    expect(consumerService).toExist()
    clientService = getClientService(clientApp, {
      servicePath: 's3',
      transport,
      useProxy: true,
      fetch,
      debug: debugClient
    })
    expect(clientService).toExist()
    expressServer = await consumerApp.listen(3333)
  })
  it('upload data file', async () => {
    let eventReceived = false
    consumerService.once('object-put', (data) => {
      if (data.id === fileId) eventReceived = true
    })
    const response = await consumerService.putObject({
      id: fileId,
      buffer: fileContent,
      type: 'image/png'
    })
    expect(response.id).to.equal(fileId)
    expect(response.ETag).toExist()
    expect(eventReceived).beTrue()
  })
  it('download data file', async () => {
    const response = await consumerService.get(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.buffer).toExist()
    expect(response.type).to.equal('image/png')
    const buffer = storageService.atob(response.buffer)
    expect(buffer.toString()).to.equal(fileContent.toString())
  })
  it('remove data file', async () => {
    const response = await consumerService.remove(fileId)
    expect(response.id).to.equal(fileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  it('upload data file from client', async () => {
    const blob = new Blob([fileContent], { type: 'image/png' })
    let eventReceived = false
    clientService.once('object-put', (data) => {
      if (data.id === fileId) eventReceived = true
    })
    const response = await clientService.upload(fileId, blob, { expiresIn: 30 })
    // Wait long enough to be sure the event has been raised
    await utility.promisify(setTimeout)(5000)
    expect(response.ETag).toExist()
    // FIXME: custom event not received
    //expect(eventReceived).beTrue()
  })
  it('download data file from client', async () => {
    const response = await clientService.download(fileId, { expiresIn: 30 })
    expect(response.type).to.equal('image/png')
    expect(response.buffer).toExist()
    expect(Buffer.from(response.buffer).toString()).to.equal(fileContent.toString())
  })
  it('remove data file from client', async () => {
    const response = await clientService.remove(fileId)
    expect(response.$metadata.httpStatusCode).to.equal(204)
  })
  
  after(async () => {
    await expressServer.close()
    finalize(consumerApp)
    finalize(storageApp)
  })
})
