const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const { method, url, ip } = req;

  // Log request
  logger.info('Incoming Request', {
    method,
    url,
    ip: ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    logger.info('Outgoing Response', {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      ip: ip || req.connection.remoteAddress,
    });

    return originalJson.call(this, data);
  };

  next();
};

module.exports = requestLogger;
