
import makeDebug from 'debug'
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

const { rest } = express

feathers.setDebug(makeDebug)
feathersClient.setDebug(makeDebug)

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

let transport

const textFileId = 'text.txt'
const imageFileId = 'image.png'
const archiveFileId = 'archive.zip'
const featuresFileId = 'features.geojson'

describe('feathers-s3-client-useproxy', () => {
  before(async () => {
    chailint(chai, util)
    serverApp = express(feathers())
    serverApp.use(express.json({ limit: 100 * 1024 * 1024 }))
    serverApp.use(express.urlencoded({ extended: true }))
    serverApp.configure(rest())
    serverApp.configure(feathersSocketio())
    expressServer = await serverApp.listen(3333)
    clientApp = feathersClient()
    const socket = io('http://localhost:3333')
    transport = feathersClient.socketio(socket)
    // Uncomment to test REST client
    //transport = feathersClient.rest('http://localhost:3333').superagent(superagent)
    clientApp.configure(transport)
  })
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
    expect(typeof getClientService).to.equal('function')
  })
  it('create s3Service', () => {
    serverApp.use('s3', new Service(options), {
      methods: ['create', 'get', 'remove', 'createMultipartUpload', 'completeMultipartUpload', 'uploadPart', 'putObject']
    })
    s3Service = serverApp.service('s3')
    expect(s3Service).toExist()
  })
  it('create s3ClientService', () => {
    s3ClientService = getClientService(clientApp, { servicePath: 's3', transport, useProxy: true })
    expect(s3ClientService).toExist()
    expect(s3ClientService.createMultipartUpload).toExist()
    expect(s3ClientService.completeMultipartUpload).toExist()
    expect(s3ClientService.uploadPart).toExist()
    expect(s3ClientService.putObject).toExist()
    expect(s3ClientService.upload).toExist()
    expect(s3ClientService.download).toExist()
  })
  it('upload text file', async () => {
    const blob = new Blob([fs.readFileSync('test/data/text.txt')], { type: 'text/plain' })
    const response = await s3ClientService.upload(textFileId, blob, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.ETag).toExist()
  })
  it('upload image file', async () => {
    const blob = new Blob([fs.readFileSync('test/data/image.png')], { type: 'image/png' })
    const response = await s3ClientService.upload(imageFileId, blob, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.ETag).toExist()
  })
  it('upload zip file', async () => {
    const blob = new Blob([fs.readFileSync('test/data/archive.zip')], { type: 'application/zip' })
    const response = await s3ClientService.upload(archiveFileId, blob, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.ETag).toExist()
  })
  it('upload features file', async () => {
    const blob = new Blob([fs.readFileSync('test/data/features.geojson')], { type: 'application/geo+json' })
    const response = await s3ClientService.upload(featuresFileId, blob, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
  it('download text file', async () => {
    const filePath = 'test/data/downloaded-text.txt'
    const response = await s3ClientService.download(textFileId, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.type).to.equal('text/plain')
    expect(response.buffer).toExist()
    fs.writeFileSync(filePath, Buffer.from(response.buffer))
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('download image file', async () => {
    const filePath = 'test/data/downloaded-image.png'
    const response = await s3ClientService.download(imageFileId, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.type).to.equal('image/png')
    expect(response.buffer).toExist()
    fs.writeFileSync(filePath, Buffer.from(response.buffer))
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('download zip file', async () => {
    const filePath = 'test/data/downloaded-archive.zip'
    const response = await s3ClientService.download(archiveFileId, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.type).to.equal('application/zip')
    expect(response.buffer).toExist()
    fs.writeFileSync(filePath, Buffer.from(response.buffer))
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('download features file', async () => {
    const filePath = 'test/data/downloaded-features.geojson'
    const response = await s3ClientService.download(featuresFileId, { expiresIn: 30 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.type).to.equal('application/geo+json')
    expect(response.buffer).toExist()
    fs.writeFileSync(filePath, Buffer.from(response.buffer))
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('delete text file', async () => {
    const response = await s3ClientService.remove(textFileId)
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
  it('delete image file', async () => {
    const response = await s3ClientService.remove(imageFileId)
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
  it('delete archive file', async () => {
    const response = await s3ClientService.remove(archiveFileId)
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
  after(async () => {
    await expressServer.close()
  })
})
