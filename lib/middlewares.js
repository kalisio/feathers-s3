import _ from 'lodash'
import moment from 'moment'
import createDebug from 'debug'
import { GetObjectCommand } from '@aws-sdk/client-s3'

const debug = createDebug('feathers-s3:middlewares')

// This middleware is useful to proxy S3 urls to get objects behind authentication or to support range requests
// It expect a route path like xxx/* where the last parameter is the path to the object in the target bucket
// It is associated with a given S3 service in order to share its configuration (client, bucket, etc.)
export function getObject (service) {
  return async (req, res) => {
    const bucket = service.bucket
    const bucketPath = service.getKey(req.params[0])
    debug('Proxying storage object from ' + `${bucket}:${bucketPath}` + ',' + req.headers.range)
    // Create the getCommand
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: bucketPath,
      Range: req.headers.range // Forward range requests
    })
    // Run the command
    const result = await service.s3Client.send(getCommand)
    // FIXME: not sure how to get an exhaustive list of headers
    // Not directly provided in the GetObjectCommandOutput
    const headers = {
      'Accept-Ranges': result.AcceptRanges,
      'Cache-Control': result.CacheControl,
      Expires: result.Expires,
      'Content-Disposition': result.ContentDisposition,
      'Content-Encoding': result.ContentEncoding,
      'Content-Language': result.ContentLanguage,
      'Content-Length': result.ContentLength,
      'Content-Range': result.ContentRange,
      'Content-Type': result.ContentType,
      ETag: result.ETag,
      'Last-Modified': result.LastModified
    }
    // Remove any undefined value as otherwise express will send it anyway
    // Convert also dates to RFC 2822
    const keys = Object.keys(headers)
    keys.forEach(key => {
      const value = headers[key]
      if (_.isNil(value)) delete headers[key]
      else if (value instanceof Date) headers[key] = moment(value).utc().format('ddd, DD MMM YYYY HH:mm:ss [GMT]')
    })
    res.set(headers)
    res.status(_.get(result, '$metadata.httpStatusCode', 200))
    result.Body
      .on('error', (err) => {
        return res.status(404).send(err)
      })
      .pipe(res)
  }
}
