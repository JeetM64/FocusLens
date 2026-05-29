/**
 * FocusLens Backend — Environment Config
 * Single source of truth for all env variables.
 */

require('dotenv').config()

const config = {
  node_env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  server: {
    port: parseInt(process.env.PORT) || 3001,
    wsPort: parseInt(process.env.WS_PORT) || 3002
  },

  postgres: {
    host:     process.env.PG_HOST     || 'localhost',
    port:     parseInt(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'focuslens',
    user:     process.env.PG_USER     || 'postgres',
    password: process.env.PG_PASSWORD || ''
  },

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/focuslens'
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379
  },

  ml: {
    serviceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000'
  }
}

module.exports = config