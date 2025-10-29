const socketIO = require('socket.io')
const logger = require('./logger')

// Stockage des utilisateurs connectés: { userId: socketId }
const onlineUsers = new Map()

// Stockage des utilisateurs en train d'écrire: { conversationId: [userId1, userId2] }
const typingUsers = new Map()

const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: 'http://localhost:5173', // URL de votre frontend
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    logger.info(`🔌 Nouvelle connexion Socket: ${socket.id}`)

    // 📌 Utilisateur se connecte
    socket.on('user:online', (userId) => {
      onlineUsers.set(userId, socket.id)
      logger.info(`✅ Utilisateur ${userId} en ligne`)

      // Notifier tous les autres utilisateurs
      socket.broadcast.emit('user:status', {
        userId,
        status: 'online',
      })
    })

    // 📌 Rejoindre une conversation spécifique
    socket.on('conversation:join', (conversationId) => {
      socket.join(conversationId)
      logger.info(
        `📥 Socket ${socket.id} a rejoint la conversation ${conversationId}`
      )
    })

    // 📌 Quitter une conversation
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(conversationId)
      logger.info(
        `📤 Socket ${socket.id} a quitté la conversation ${conversationId}`
      )
    })

    // 📌 Envoyer un message (émis depuis le controller)
    socket.on('message:send', (data) => {
      const { conversationId, message } = data

      // Envoyer le message à tous les participants de la conversation
      io.to(conversationId).emit('message:receive', {
        conversationId,
        message,
      })

      logger.info(`💬 Message envoyé dans conversation ${conversationId}`)
    })

    // 📌 Utilisateur en train d'écrire
    socket.on('typing:start', ({ conversationId, userId, userName }) => {
      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, [])
      }

      const typing = typingUsers.get(conversationId)
      if (!typing.includes(userId)) {
        typing.push(userId)
      }

      // Notifier les autres participants
      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId,
        userName,
        isTyping: true,
      })

      logger.info(`⌨️ ${userName} est en train d'écrire dans ${conversationId}`)
    })

    // 📌 Utilisateur arrête d'écrire
    socket.on('typing:stop', ({ conversationId, userId }) => {
      if (typingUsers.has(conversationId)) {
        const typing = typingUsers.get(conversationId)
        const index = typing.indexOf(userId)
        if (index > -1) {
          typing.splice(index, 1)
        }
      }

      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId,
        isTyping: false,
      })
    })

    // 📌 Marquer les messages comme lus
    socket.on('messages:read', ({ conversationId, userId }) => {
      io.to(conversationId).emit('messages:read:update', {
        conversationId,
        userId,
      })

      logger.info(
        `✅ Messages lus dans conversation ${conversationId} par ${userId}`
      )
    })

    // 📌 Déconnexion
    socket.on('disconnect', () => {
      // Trouver l'utilisateur qui s'est déconnecté
      let disconnectedUserId = null
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId
          onlineUsers.delete(userId)
          break
        }
      }

      if (disconnectedUserId) {
        // Notifier tous les autres utilisateurs
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

// Fonction helper pour émettre des événements depuis les controllers
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

module.exports = {
  initializeSocket,
  emitToConversation,
  emitToUser,
  isUserOnline,
}
