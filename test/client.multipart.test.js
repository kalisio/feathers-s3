
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import feathersClient from '@feathersjs/client'
import feathersSocketio from '@feathersjs/socketio'
import io from 'socket.io-client'
import { Service, getClientService } from '../lib/index.js'
import fs from 'fs'
import { Blob } from 'buffer'

let serverApp, expressServer, clientApp, s3Service, s3ClientService

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

const featuresFileId = 'features.geojson'

describe('feathers-s3-client-multipart', () => {
  before(async () => {
    chailint(chai, util)
    serverApp = express(feathers())
    serverApp.configure(feathersSocketio())
    expressServer = await serverApp.listen(3000)
    clientApp = feathersClient()
    const socket = io('http://localhost:3000')
    clientApp.configure(feathersClient.socketio(socket))
  })
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
    expect(typeof getClientService).to.equal('function')
  })
  it('create s3Service', () => {
    serverApp.use('s3', new Service(options), {
      methods: ['create', 'get', 'remove', 'createMultipartUpload', 'completeMultipartUpload'] 
    })
    s3Service = serverApp.service('s3')
    expect(s3Service).toExist()
  })
  it('create s3ClientService', () => {
    s3ClientService = getClientService(clientApp, { servicePath: 's3' })
    expect(s3ClientService).toExist()
  })
/*  it('upload features file', async () => {
    const blob = new Blob([fs.readFileSync('test/data/features.geojson')], { type: 'application/geo+json' })
    const response = await s3ClientService.upload(featuresFileId, blob, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.headers.raw().etag).toExist()
  })
  */
  after(async () => {
    await expressServer.close()
  })
})
