const { createLogger, format, transports } = require('winston')
require('winston-daily-rotate-file')
const path = require('path')
const fs = require('fs')

const logDir = path.join(__dirname, '../../../logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level}] ${message}`
    })
  ),
  transports: [
    new transports.DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new transports.Console()
  ]
})

module.exports = logger
