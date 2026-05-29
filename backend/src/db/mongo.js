const mongoose = require('mongoose')
const logger = require('../utils/logger')

async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/focuslens'

  mongoose.connection.on('disconnected', () => logger.warn('[MongoDB] Disconnected'))
  mongoose.connection.on('reconnected', () => logger.info('[MongoDB] Reconnected'))

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  })

  logger.info('[MongoDB] Connected')
}

module.exports = { connectMongo }