import { feathers } from '@feathersjs/feathers'
import express from '@feathersjs/express'
import socketio from '@feathersjs/socketio'
import { Service } from '../lib/Service.js'

const port = process.env.PORT || 3333

// Create the Feathers app
const app = express(feathers())
// Configure express
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
// Host the public folder
app.use('/', express.static('./public'))
// Serve feathers-s3
app.use('/feathers-s3', express.static('../lib'))
// Configure Socket.io
app.configure(socketio({ cors: { origin: '*' } }))
// Define the options used to instanciate the S3 service
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
// Register the message service on the Feathers application
// /!\ do not forget to declare the custom methods
app.use('s3', new Service(options), {
  methods: ['create', 'get', 'find', 'remove', 'createMultipartUpload', 'completeMultipartUpload', 'uploadPart', 'putObject']
})
// Start the server
app.listen(port).then(() => {
  console.log(`Feathers server listening on localhost:${port}`)
})