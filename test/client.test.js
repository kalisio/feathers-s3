
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
// import feathersConfiguration from '@feathersjs/configuration'
import feathersClient from '@feathersjs/client'
import feathersSocketio from '@feathersjs/socketio'
import io from 'socket.io-client'
import { Service, Client } from '../lib/index.js'
import fs from 'fs'

let serverApp, clientApp, s3Service, s3Client

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

const prefix = 'feathers-s3'
const textFileId = prefix + '/text.txt'
const imageFileId = prefix + '/image.png'
const archiveFileId = prefix + '/arvhive.zip'

describe('feathers-s3-client', () => {
  before(async () => {
    chailint(chai, util)
    serverApp = express(feathers())
    serverApp.configure(feathersSocketio())
    await serverApp.listen(3000)
    clientApp = feathersClient()
    const socket = io('http://localhost:3000')
    clientApp.configure(feathersClient.socketio(socket))
  })
  it('is ES module compatible', () => {
    expect(typeof Service).to.equal('function')
    expect(typeof Client).to.equal('function')
  })
  it('create the s3Service', () => {
    serverApp.use('s3', new Service(options))
    s3Service = serverApp.service('s3')
    expect(s3Service).toExist()
  })
  it('create the s3Client', () => {
    s3Client = new Client(clientApp, { servicePath: 's3' })
    expect(s3Client).toExist()
  })
  it('upload text file', async () => {
    const response = await s3Client.upload(textFileId, 'test/data/text.txt', 'text/plain', { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.headers.raw().etag).toExist()
  })
  it('upload image file', async () => {
    const response = await s3Client.upload(imageFileId, 'test/data/image.png', 'image/png', { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.headers.raw().etag).toExist()
  })
  it('upload zip file', async () => {
    const response = await s3Client.upload(archiveFileId, 'test/data/archive.zip', 'application/zip', { expiresIn: 60 })
    expect(response.status).to.equal(200)
    expect(response.headers.raw().etag).toExist()
  })
  it('download text file', async () => {
    const filePath = 'test/data/downloaded-text.txt'
    const response = await s3Client.download(textFileId, filePath, 'text/plain', { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('download image file', async () => {
    const filePath = 'test/data/downloaded-image.png'
    const response = await s3Client.download(imageFileId, filePath, 'image/png', { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('download zip file', async () => {
    const filePath = 'test/data/downloaded-archive.zip'
    const response = await s3Client.download(archiveFileId, filePath, 'application/zip', { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(fs.existsSync(filePath)).beTrue()
    fs.unlinkSync(filePath)
  })
  it('delete text file', async () => {
    const response = await s3Client.remove(textFileId, { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
  it('delete image file', async () => {
    const response = await s3Client.remove(imageFileId, { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
  it('delete archive file', async () => {
    const response = await s3Client.remove(archiveFileId, { expiresIn: 60 })
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
  })
})
