
import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import feathers from '@feathersjs/feathers'
import configuration from '@feathersjs/configuration'
import { Service } from '../lib/index.js'

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

const fileKey = 'text.txt'

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
  it('create \'PUT\' signedUrl', async () => {
    const data = {
      id: fileKey,
      expiresIn: 60
    }
    const response = await service.create(data)
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.signedUrl).toExist()
  })
  it('create \'GET\' signedUrl', async () => {
    const data = {
      id: fileKey,
      expiresIn: 60
    }
    const response = await service.create(data)
    expect(response.ok).toExist()
    expect(response.status).to.equal(200)
    expect(response.signedUrl).toExist()
  })
})
