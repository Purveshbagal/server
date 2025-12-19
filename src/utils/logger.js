const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const getTimestamp = () => new Date().toISOString();

const formatLog = (level, message, data = {}) => {
  return JSON.stringify({
    timestamp: getTimestamp(),
    level,
    message,
    ...data,
  });
};

const writeLog = (level, message, data = {}) => {
  const logFile = path.join(logsDir, `${level.toLowerCase()}.log`);
  const logEntry = formatLog(level, message, data);
  
  // Console log
  console.log(logEntry);
  
  // File log
  fs.appendFileSync(logFile, logEntry + '\n', { encoding: 'utf8' });
};

const logger = {
  error: (message, data = {}) => writeLog(LOG_LEVELS.ERROR, message, data),
  warn: (message, data = {}) => writeLog(LOG_LEVELS.WARN, message, data),
  info: (message, data = {}) => writeLog(LOG_LEVELS.INFO, message, data),
  debug: (message, data = {}) => writeLog(LOG_LEVELS.DEBUG, message, data),
};

module.exports = logger;
