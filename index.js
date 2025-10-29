const http = require('http')
const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')
const { initializeSocket } = require('./utils/socketConfig')

const server = http.createServer(app)

const io = initializeSocket(server)

app.set('io', io)

server.listen(config.PORT, () => {
  logger.info(`✅ Server running on port ${config.PORT}`)
  logger.info(`📡 WebSocket server ready`)
})
