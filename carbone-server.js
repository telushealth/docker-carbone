const fs = require('fs')
const path = require('path')
const util = require('util')
const cors = require('cors')
const AWS = require('aws-sdk')
const dotenv = require('dotenv')
const multer = require('multer')
const mime = require('mime-types')
const carbone = require('carbone')
const express = require('express')
const nativeAuth = require('basic-auth')
const basicAuth = require('express-basic-auth')
const exec = util.promisify(require('child_process').exec)

const app = express()
dotenv.config()
AWS.config.update({ region: process.env.AWS_REGION })

const username = process.env.USER || 'user'
const password = process.env.PASSWORD || 'password'
const users = {}
users[username] = password
const auth = basicAuth({
  users,
  unauthorizedResponse: {
    message: 'Bad credentials',
  },
})

app.use(
  cors({
    origin: process.env.CORS_WHITELIST_ORIGIN,
  })
)

app.use(express.urlencoded({ extended: false }))
app.use(express.json({ limit: '50mb' }))

app.get('/', function(req, res) {
  let user = nativeAuth(req)
  if (user === undefined || user['name'] !== username || user['pass'] !== password) {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="Node"')
    res.end('Unauthorized')
  } else {
    res.sendFile(path.join(__dirname, 'ui/index.html'))
  }
})

app.get('/js', function(req, res) {
  res.sendFile(path.join(__dirname, 'ui/script.js'))
})

app.get('/download/:file', function(req, res) {
  const filePath = path.join(__dirname, 'templates/' + req.params.file)
  if (fs.existsSync(filePath)) {
    res.download(filePath, req.params.file)
  } else {
    res.statusCode = 404
    res.json({ message: 'File not found' })
  }
})

app.delete('/template/:file', function(req, res) {
  const filePath = path.join(__dirname, 'templates/' + req.params.file)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    res.json({ message: 'File deleted' })
  } else {
    res.statusCode = 404
    res.json({ message: 'File not found' })
  }
})

app.get('/template', auth, async (req, res) => {
  const files = await fs.promises.readdir(`./templates`)
  res.send(files.filter(file => file !== '.gitignore'))
})

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, './templates')
  },
  filename(req, file = {}, cb) {
    const { originalname } = file
    const fileExtension = (originalname.match(/\.+[\S]+$/) || [])[0]
    cb(null, `${originalname.trim()}__${Date.now()}${fileExtension}`)
  },
})

const upload = multer({ storage: storage })
app.post('/template', auth, upload.single(`template`), async (req, res) => {
  res.send('Template Uploaded!')
})

async function replaceImages(template, images) {
  let newTemplate = template.split('.')
  newTemplate = 'temp.' + newTemplate[newTemplate.length - 1]

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    try {
      await exec(
        `sh replace-image.sh ${template} ${newTemplate} ${image.destination} ${image.source}`
      )
      // temp is temporary folder defined in shell script above
      return `temp/${newTemplate}`
    } catch (err) {
      throw new Error(err)
    }
  }
}

function render(template, data, options) {
  return new Promise((resolve, reject) => {
    carbone.render(template, data, options, (err, result) => {
      if (err) {
        reject(new Error(err))
      } else {
        resolve(result)
      }
    })
  })
}

function seveToS3 (Body, Key) {
  return new Promise((resolve, reject) => {
    const s3 = new AWS.S3()
    s3.upload({
      ACL: 'public-read',
      Bucket: process.env.AWS_BUCKET_NAME,
      Body,
      Key
    }, function (err, data) {
      if (err) {
        reject(new Error(err))
      } else {
        resolve(data.Location)
      }
    })
  })
}

async function generate(res, params, download = false) {
  let { template, filename, data, options, imagesReplace } = params

  if (!template.includes('templates')) {
    template = `templates/${template}`
  }

  if (imagesReplace) {
    template = await replaceImages(template, imagesReplace)
  }

  if (options.convertTo) {
    //change filename extension of converted (ie to PDF)
    filename = filename.replace(/\.[^/.]+$/, '')
    filename = filename + '.' + options.convertTo
  }

  try {
    const buffer = await render(template, data, options)

    if (download) {
      res.set({
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Type': mime.lookup(filename),
        'Content-Disposition': `attachment; filename=${filename}`
      })
      res.end(buffer)
    } else {
      try {
        const url = await seveToS3(buffer, filename)
        res.json({ url })
      } catch (e) {
        res.statusCode = 500
        res.json({ message: e.message || 'Error save to S3' })
      }
    }
  } catch (e) {
    res.statusCode = 500
    res.json({ message: e.message })
  }
}

app.get('/generate', auth, async (req, res) => {
  const template = req.query.template
  const filename = req.query.filename
  const imagesReplace = JSON.parse(req.query.imagesReplace)
  const data = JSON.parse(req.query.json)
  const options = JSON.parse(req.query.options)

  return generate(res, { template, filename, data, options, imagesReplace }, req.query.download === 'true')
})

app.post('/generate', auth, async (req, res) => {
  const template = req.body.template
  const filename = req.body.filename
  const data = req.body.json
  const options = req.body.options
  const imagesReplace = req.body.imagesReplace

  return generate(res, { template, filename, data, options, imagesReplace }, req.query.download === 'true')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
