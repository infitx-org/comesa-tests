const AWS = require('aws-sdk')
const path = require('path');
const fs = require('fs')

module.exports = async function s3upload({config, bucket}, reportPath, logs) {
    const s3 = new AWS.S3({ apiVersion: '2012-10-17', ...(config || {}) })
    try {
      const { Location } = await s3.upload({
        Bucket: bucket,
        Key: `comesa-tests/${path.basename(path.dirname(reportPath))}`,
        Body: fs.createReadStream(reportPath),
        ContentType: 'text/html'
      }).promise();
      return Location;
    } catch (err) {
      logs.push(`Error uploading file: ${err.message}`)
      reject(err)
    }
}
