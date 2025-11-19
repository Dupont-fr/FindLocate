const socketIO = require('socket.io')
const logger = require('./logger')

const onlineUsers = new Map()
const typingUsers = new Map()

let ioInstance = null

const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://findlocate-1.onrender.com',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  ioInstance = io

  io.on('connection', (socket) => {
    logger.info(`  Nouvelle connexion Socket: ${socket.id}`)

    socket.on('user:online', (userId) => {
      onlineUsers.set(userId, socket.id)
      logger.info(`✅ Utilisateur ${userId} en ligne`)

      socket.join(`user_${userId}`)
      logger.info(
        ` Utilisateur ${userId} a rejoint sa room personnelle user_${userId}`
      )

      socket.broadcast.emit('user:status', {
        userId,
        status: 'online',
      })
    })

    socket.on('conversation:join', (conversationId) => {
      socket.join(conversationId)
      logger.info(
        ` Socket ${socket.id} a rejoint la conversation ${conversationId}`
      )
    })

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(conversationId)
      logger.info(
        ` Socket ${socket.id} a quitté la conversation ${conversationId}`
      )
    })

    socket.on('message:send', (data) => {
      const { conversationId, message } = data

      io.to(conversationId).emit('message:receive', {
        conversationId,
        message,
      })

      logger.info(`💬 Message envoyé dans conversation ${conversationId}`)
    })

    socket.on('typing:start', ({ conversationId, userId, userName }) => {
      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, [])
      }

      const typing = typingUsers.get(conversationId)
      if (!typing.includes(userId)) {
        typing.push(userId)
      }

      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId,
        userName,
        isTyping: true,
      })

      logger.info(`⌨️ ${userName} est en train d'écrire dans ${conversationId}`)
    })

    socket.on('typing:stop', ({ conversationId, userId }) => {
      if (typingUsers.has(conversationId)) {
        const typing = typingUsers.get(conversationId)
        const index = typing.indexOf(userId)
        if (index > -1) typing.splice(index, 1)
      }

      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId,
        isTyping: false,
      })
    })

    socket.on('messages:read', ({ conversationId, userId }) => {
      io.to(conversationId).emit('messages:read:update', {
        conversationId,
        userId,
      })

      logger.info(
        `✅ Messages lus dans conversation ${conversationId} par ${userId}`
      )
    })

    socket.on('disconnect', () => {
      let disconnectedUserId = null
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId
          onlineUsers.delete(userId)
          break
        }
      }

      if (disconnectedUserId) {
        socket.broadcast.emit('user:status', {
          userId: disconnectedUserId,
          status: 'offline',
        })

        logger.info(`❌ Utilisateur ${disconnectedUserId} hors ligne`)
      }

      logger.info(` Déconnexion Socket: ${socket.id}`)
    })
  })

  return io
}

const emitToUserRoom = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, data)
}

const emitToConversation = (io, conversationId, event, data) => {
  io.to(conversationId).emit(event, data)
}

const emitToUser = (io, userId, event, data) => {
  const socketId = onlineUsers.get(userId)
  if (socketId) {
    io.to(socketId).emit(event, data)
  }
}

const isUserOnline = (userId) => {
  return onlineUsers.has(userId)
}

const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized! Call initializeSocket first.')
  }
  return ioInstance
}

module.exports = {
  initializeSocket,
  emitToConversation,
  emitToUser,
  emitToUserRoom,
  isUserOnline,
  getIO,
}
