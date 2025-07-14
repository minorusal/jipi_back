'use strict'

require('dotenv').config()

// Utilizando el paquete dotenv en este módulo nos permite tener poder acceder a
// esta información importando el módulo y accediendo a sus keys mediante
// desestructuración de objetos. Por ejemplo, si en el archivo foo.js necesitamos
// obtener los datos de config.email.sender.name podemos:

// const {  email: { sender: { name } } } = require('./config')

const config = {
  mysql: {
    host: process.env.MYSQL_DB_HOST,
    user: process.env.MYSQL_DB_USER,
    password: process.env.MYSQL_DB_PASS,
    database: process.env.MYSQL_DB_NAME,
    port: process.env.MYSQL_DB_PORT,
    encoding: 'utf8',
    charset: 'utf8mb4'
  },
  moneyExchange: {
    endpoint: 'https://api.exchangeratesapi.io',
    base: 'USD'
  },
  email: {
    key: process.env.SENDGRID_API_KEY,
    sender: {
      name: process.env.MAIL_SENDER_NAME,
      email: process.env.MAIL_SENDER_EMAIL,
      replyTo: process.env.MAIL_REPLY_TO,
      hola: process.env.MAIL_HOLA
    }
  },
  emailjet: {
    key: process.env.MAILJET_API_KEY,
    secretKey: process.env.MAILJET_SECRET_KEY,
    sender: {
      from: process.env.MAILJET_FROM_EMAIL,
      name: process.env.MAILJET_SENDER_NAME,
      email: process.env.MAILJET_SENDER_EMAIL,
      replyTo: process.env.MAILJET_REPLY_TO,
      hola: process.env.MAILJET_HOLA
    }
  },
  web: {
    url: process.env.MC_BASE_URL,
    apiURL: process.env.MC_BASE_API_URL
  },
  tokenSecretKey: process.env.MC_TOKEN_SECRET_KEY,
  stripe: {
    key: process.env.STRIPE_PRIVATE_KEY
  },
  aws: {
    id: process.env.AWS_ID,
    secret: process.env.AWS_SECRET,
    s3: {
      name: process.env.AWS_S3_NAME,
      nameVideos: process.env.AWS_S3_NAME_VIDEOS
    },
    sns: {
      id: process.env.AWS_SNS_ID,
      secret: process.env.AWS_SNS_SECRET,
      region: process.env.AWS_SNS_REGION
    }
  },
  cronosSecretKey: process.env.MC_TOKEN_SECRET_KEY_CRONOS,
  hadesToCronosSecretKey: process.env.MC_TOKEN_SECRET_KEY_HADES_TO_CRONOS,
  cronosURL: {
    certification: process.env.CRONOS_BASE_URL_CERTIFICATION,
    report: process.env.CRONOS_BASE_URL_REPORT
  },
  maxSizes: {
    images: Number(process.env.MAX_SIZE_IMAGES),
    videos: Number(process.env.MAX_SIZE_VIDEOS),
    pdf: Number(process.env.MAX_SIZE_PDF),
  },
  externalJWTOptions: {
    secretKey: process.env.EXTERNAL_API_JWT_SECRET_KEY,
    expiresTime: process.env.EXTERNAL_API_JWT_EXPIRES_TIME
  },
  blogAuthor: process.env.BLOG_PROFILE_AUTHOR,
  globalAuth: {
    keyCipher: process.env.KEY_CIPHER,
    expiresTime: process.env.MC_JWT_EXPIRES_TIME,
    refreshExpiresTime: process.env.MC_JWT_REFRESH_EXPIRES_TIME,
    userSecretKey: {
      web: process.env.MC_JWT_USER_TOKEN_WEB,
      ios: process.env.MC_JWT_USER_TOKEN_IOS,
      android: process.env.MC_JWT_USER_TOKEN_ANDROID,
      blog: process.env.MC_JWT_USER_TOKEN_BLOG
    },
    genericSecretKey: {
      web: process.env.MC_JWT_GENERIC_TOKEN_WEB,
      ios: process.env.MC_JWT_GENERIC_TOKEN_IOS,
      android: process.env.MC_JWT_GENERIC_TOKEN_ANDROID,
      blog: process.env.MC_JWT_GENERIC_TOKEN_BLOG
    },
    refreshSecretKey: {
      web: process.env.MC_JWT_USER_REFRESH_TOKEN_WEB,
      ios: process.env.MC_JWT_USER_REFRESH_TOKEN_IOS,
      android: process.env.MC_JWT_USER_REFRESH_TOKEN_ANDROID,
      blog: process.env.MC_JWT_USER_REFRESH_TOKEN_BLOG
    }

  },
  server: {
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV
  },
  dbName: process.env.DB_NAME || 'test',
  dbPort: process.env.DB_PORT || 3306,
}

module.exports = config
