const logger = require('../../utils/logger')

function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    path: req.path
  })
}

module.exports = errorHandler