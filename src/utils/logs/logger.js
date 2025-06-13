const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Define ruta
let logsDir;
if (process.platform === 'linux') {
  logsDir = path.resolve('/home/ubuntu/logs');
} else {
  logsDir = path.resolve(__dirname, '../../../logs');
}

// Crear carpeta si no existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Formatear fecha a zona horaria de México
function formatDateInMexicoCity(timestamp) {
  const utcDate = new Date(timestamp);
  const options = {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat([], options);
  const parts = formatter.formatToParts(utcDate);
  const dateParts = {};
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') {
      dateParts[type] = value;
    }
  });

  return `${dateParts.year}-${dateParts.month}-${dateParts.day} ${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
}

// Define el formato de log
const customFormat = format.combine(
  format.timestamp(),
  format.printf(({ timestamp, level, message }) => {
    const formattedDate = formatDateInMexicoCity(timestamp);
    return `[${formattedDate}] ${level}: ${message}`;
  })
);

// Logger con rotación diaria
const logger = createLogger({
  format: customFormat,
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      dirname: logsDir,
      filename: `%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: '30d',
      format: customFormat
    })
  ]
});

module.exports = logger;
