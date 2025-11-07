const socketIO = require('socket.io')
const logger = require('./logger')

const onlineUsers = new Map()

const typingUsers = new Map()

let ioInstance = null

const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  // Sauvegarder l'instance io pour l'utiliser dans getIO()
  ioInstance = io

  io.on('connection', (socket) => {
    logger.info(`🔌 Nouvelle connexion Socket: ${socket.id}`)

    //  Utilisateur se connecte
    socket.on('user:online', (userId) => {
      onlineUsers.set(userId, socket.id)
      logger.info(`✅ Utilisateur ${userId} en ligne`)

      // NEW ✅ L'utilisateur rejoint sa room personnelle
      // Cela permet d'envoyer des notifications privées via io.to(`user_${userId}`)
      socket.join(`user_${userId}`)
      logger.info(
        `🏠 Utilisateur ${userId} a rejoint sa room personnelle user_${userId}`
      )

      // Notifier les autres
      socket.broadcast.emit('user:status', {
        userId,
        status: 'online',
      })
    })

    //  Rejoindre une conversation spécifique
    socket.on('conversation:join', (conversationId) => {
      socket.join(conversationId)
      logger.info(
        `📥 Socket ${socket.id} a rejoint la conversation ${conversationId}`
      )
    })

    //  Quitter une conversation
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(conversationId)
      logger.info(
        `📤 Socket ${socket.id} a quitté la conversation ${conversationId}`
      )
    })

    //  Envoyer un message (émis depuis le controller)
    socket.on('message:send', (data) => {
      const { conversationId, message } = data

      io.to(conversationId).emit('message:receive', {
        conversationId,
        message,
      })

      logger.info(`💬 Message envoyé dans conversation ${conversationId}`)
    })

    //  Utilisateur en train d'écrire
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

    //  Utilisateur arrête d'écrire
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

    //  Marquer les messages comme lus
    socket.on('messages:read', ({ conversationId, userId }) => {
      io.to(conversationId).emit('messages:read:update', {
        conversationId,
        userId,
      })

      logger.info(
        `✅ Messages lus dans conversation ${conversationId} par ${userId}`
      )
    })

    //  Déconnexion
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

      logger.info(`🔌 Déconnexion Socket: ${socket.id}`)
    })
  })

  return io
}

// émettre vers une room utilisateur
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

// Fonction pour obtenir l'instance io depuis n'importe où
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
