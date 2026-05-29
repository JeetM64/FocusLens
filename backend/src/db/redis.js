const Redis = require('ioredis')
const logger = require('../utils/logger')

let client = null

async function connectRedis() {
  client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 5000)
  })

  client.on('error', (err) => logger.error('[Redis] Error:', err.message))
  client.on('reconnecting', () => logger.warn('[Redis] Reconnecting...'))

  await client.connect()
  logger.info('[Redis] Connected')
  return client
}

function getRedis() {
  if (!client) throw new Error('Redis not connected')
  return client
}

module.exports = { connectRedis, getRedis }