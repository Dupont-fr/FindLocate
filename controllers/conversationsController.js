const conversationsRouter = require('express').Router()
const Conversation = require('../models/conversation')
const { userExtractor } = require('../utils/middleware')
const {
  encryptMessage,
  decryptMessage,
  isEncrypted,
} = require('../utils/encryption')

// normaliser l'ID des conversations
const normalizeConversation = (conv) => {
  const obj = conv.toObject ? conv.toObject() : conv
  return {
    ...obj,
    id: obj._id?.toString() || obj.id, //  Ajoute id à partir de _id
  }
}

//  Récupérer toutes les conversations d'un utilisateur
conversationsRouter.get('/', userExtractor, async (req, res, next) => {
  try {
    const userId = req.user.id

    // Chercher les conversations où l'utilisateur est user1 OU user2
    const conversations = await Conversation.find({
      $or: [{ user1Id: userId }, { user2Id: userId }],
      deletedFor: { $ne: userId }, // Exclure les conversations supprimées
    }).sort({ lastMessageTime: -1 })

    const transformedConversations = conversations.map((conv) => {
      const convObj = normalizeConversation(conv)
      const isUser1 = convObj.user1Id === userId

      let lastMessage = convObj.lastMessage
      try {
        if (lastMessage && !lastMessage.startsWith('[')) {
          lastMessage = decryptMessage(lastMessage)
        }
      } catch (error) {
        console.error('⚠️ Erreur déchiffrement lastMessage:', error.message)
      }

      //  Déchiffrer
      const decryptedMessages = convObj.messages.map((msg) => {
        try {
          return {
            ...msg,
            text: msg.text ? decryptMessage(msg.text) : '', // 🆕 Déchiffrer chaque message
          }
        } catch (error) {
          console.error('⚠️ Erreur déchiffrement message:', error.message)
          return msg
        }
      })

      return {
        ...convObj,
        messages: decryptedMessages, //  Messages déchiffrés
        participantId: isUser1 ? convObj.user2Id : convObj.user1Id,
        participantName: isUser1 ? convObj.user2Name : convObj.user1Name,
        participantAvatar: isUser1 ? convObj.user2Avatar : convObj.user1Avatar,
        lastMessage, //
        unreadCount: decryptedMessages.filter(
          (msg) => msg.senderId !== userId && !msg.read
        ).length,
      }
    })

    console.log(
      '✅ Envoi de',
      transformedConversations.length,
      'conversations avec IDs normalisés'
    ) // 🆕 Log
    res.json(transformedConversations)
  } catch (error) {
    console.error('❌ Erreur récupération conversations:', error)
    next(error)
  }
})

//  Récupérer une conversation spécifique
conversationsRouter.get('/:id', userExtractor, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    if (
      conversation.user1Id !== req.user.id &&
      conversation.user2Id !== req.user.id
    ) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const conversationObj = normalizeConversation(conversation)

    conversationObj.messages = conversationObj.messages.map((msg) => {
      try {
        const decryptedText = msg.text ? decryptMessage(msg.text) : '' // 🆕 Déchiffrer

        console.log('🔍 Message:', {
          //  Log de débogage
          id: msg.id,
          original: msg.text?.substring(0, 30) + '...',
          decrypted: decryptedText?.substring(0, 30) + '...',
          isEncrypted: isEncrypted(msg.text),
        })

        return {
          ...msg,
          text: decryptedText,
        }
      } catch (error) {
        console.error('❌ Erreur déchiffrement message:', msg.id, error.message)
        return {
          ...msg,
          text: msg.text,
        }
      }
    })

    console.log(
      ' Conversation',
      conversationObj.id,
      'avec',
      conversationObj.messages.length,
      'messages'
    ) //

    res.json(conversationObj)
  } catch (error) {
    console.error('❌ Erreur récupération conversation:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid conversation ID' })
    }
    next(error)
  }
})

// Créer une nouvelle conversation ou récupérer une existante
conversationsRouter.post('/', userExtractor, async (req, res, next) => {
  try {
    const { user2Id, user2Name, user2Avatar } = req.body
    const user1Id = req.user.id

    if (!user2Id || !user2Name) {
      return res.status(400).json({
        error: 'user2Id and user2Name are required',
      })
    }

    // Vérifier si une conversation existe déjà
    let conversation = await Conversation.findOne({
      $or: [
        { user1Id, user2Id },
        { user1Id: user2Id, user2Id: user1Id },
      ],
    })

    // Si la conversation existe et qu'elle a été supprimée, la restaurer
    if (conversation) {
      if (conversation.deletedFor.includes(user1Id)) {
        conversation.deletedFor = conversation.deletedFor.filter(
          (id) => id !== user1Id
        )
        await conversation.save()
      }

      const convObj = normalizeConversation(conversation)
      convObj.messages = convObj.messages.map((msg) => {
        try {
          return {
            ...msg,
            text: msg.text ? decryptMessage(msg.text) : '',
          }
        } catch (error) {
          console.error('⚠️ Erreur déchiffrement:', error)
          return msg
        }
      })

      console.log('✅ Conversation existante retournée avec id:', convObj.id)
      return res.json(convObj)
    }

    // Créer une nouvelle conversation
    const newConversation = new Conversation({
      user1Id,
      user1Name: `${req.user.firstName} ${req.user.lastName}`,
      user1Avatar: req.user.profilePicture,
      user2Id,
      user2Name,
      user2Avatar:
        user2Avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      messages: [],
      deletedFor: [],
    })

    const savedConversation = await newConversation.save()
    const normalizedConv = normalizeConversation(savedConversation)

    console.log('✅ Nouvelle conversation créée avec id:', normalizedConv.id)
    res.status(201).json(normalizedConv)
  } catch (error) {
    console.error('❌ Erreur création conversation:', error)
    next(error)
  }
})

//  Ajouter un message à une conversation
conversationsRouter.post(
  '/:id/messages',
  userExtractor,
  async (req, res, next) => {
    try {
      if (!req.params.id || req.params.id === 'undefined') {
        console.error(
          '❌ ID de conversation manquant ou invalide:',
          req.params.id
        )
        return res
          .status(400)
          .json({ error: 'Valid conversation ID is required' })
      }

      const conversation = await Conversation.findById(req.params.id)

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      if (
        conversation.user1Id !== req.user.id &&
        conversation.user2Id !== req.user.id
      ) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const { text, mediaType, mediaUrl, mediaName, mediaSize } = req.body

      if (!text?.trim() && !mediaUrl) {
        return res
          .status(400)
          .json({ error: 'Message text or media is required' })
      }

      const encryptedText = text?.trim() ? encryptMessage(text.trim()) : ''

      const newMessage = {
        id: Date.now().toString(),
        senderId: req.user.id,
        senderName: `${req.user.firstName} ${req.user.lastName}`,
        senderAvatar: req.user.profilePicture,
        text: encryptedText,
        mediaType: mediaType || null,
        mediaUrl: mediaUrl || '',
        mediaName: mediaName || '',
        mediaSize: mediaSize || 0,
        read: false,
        createdAt: new Date(),
      }

      conversation.messages.push(newMessage)
      conversation.lastMessage = text?.trim()
        ? encryptMessage(text.trim())
        : `[${mediaType || 'Media'}]`
      conversation.lastMessageTime = new Date()

      const updatedConversation = await conversation.save()
      console.log(
        '✅ Message ajouté (chiffré) à la conversation:',
        conversation.id
      ) //  Log

      //  Déchiffrer le message avant de l'envoyer via WebSocket
      const decryptedMessage = {
        ...newMessage,
        text: text?.trim() || '', // Envoyer le texte en clair via WebSocket
      }

      // 📡 Émettre l'événement WebSocket
      const io = req.app.get('io')
      if (io) {
        io.to(req.params.id).emit('message:receive', {
          conversationId: req.params.id,
          message: decryptedMessage, //  Message déchiffré pour le temps réel
        })
        //  Envoyer une notification au destinataire
        // Déterminer qui est le destinataire (l'autre utilisateur)
        const recipientId =
          conversation.user1Id === req.user.id
            ? conversation.user2Id
            : conversation.user1Id

        const recipientName =
          conversation.user1Id === req.user.id
            ? conversation.user2Name
            : conversation.user1Name

        // 🔔 Émettre une notification spécifique au destinataire
        const { emitToUser } = require('../utils/socketConfig')
        emitToUser(io, recipientId, 'notification:new-message', {
          type: 'new-message',
          conversationId: req.params.id,
          senderId: req.user.id,
          senderName: `${req.user.firstName} ${req.user.lastName}`,
          senderAvatar: req.user.profilePicture,
          messagePreview: text?.trim().substring(0, 50) || '[Média]',
          timestamp: new Date().toISOString(),
        })

        console.log(
          `🔔 Notification envoyée à ${recipientName} (${recipientId})`
        )
      }

      //  AJOUT: Normaliser et déchiffrer tous les messages avant de renvoyer la réponse
      const responseConversation = normalizeConversation(updatedConversation)
      responseConversation.messages = responseConversation.messages.map(
        (msg) => {
          try {
            return {
              ...msg,
              text: msg.text ? decryptMessage(msg.text) : '',
            }
          } catch (error) {
            console.error('⚠️ Erreur déchiffrement:', error)
            return msg
          }
        }
      )

      res.json(responseConversation)
    } catch (error) {
      console.error('❌ Erreur ajout message:', error)
      next(error)
    }
  }
)

//  Modifier un message
conversationsRouter.put(
  '/:id/messages/:messageId',
  userExtractor,
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findById(req.params.id)

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      const message = conversation.messages.find(
        (m) => m.id === req.params.messageId
      )

      if (!message) {
        return res.status(404).json({ error: 'Message not found' })
      }

      // Vérifier que l'utilisateur est l'auteur du message
      if (message.senderId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const { text } = req.body

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Message text is required' })
      }

      //  AJOUT: Chiffrer le nouveau texte avant sauvegarde
      message.text = encryptMessage(text.trim())
      message.updatedAt = new Date()

      await conversation.save()
      console.log('✅ Message modifié (chiffré):', req.params.messageId) // 🆕 Log

      // 📡 Émettre l'événement WebSocket
      const io = req.app.get('io')
      if (io) {
        io.to(req.params.id).emit('message:updated', {
          conversationId: req.params.id,
          messageId: req.params.messageId,
          text: text.trim(), //  Envoyer le texte en clair via WebSocket
        })
      }

      const responseConversation = normalizeConversation(conversation)
      responseConversation.messages = responseConversation.messages.map(
        (msg) => {
          try {
            return {
              ...msg,
              text: msg.text ? decryptMessage(msg.text) : '',
            }
          } catch (error) {
            console.error('⚠️ Erreur déchiffrement:', error)
            return msg
          }
        }
      )

      res.json(responseConversation)
    } catch (error) {
      console.error('❌ Erreur modification message:', error)
      next(error)
    }
  }
)

//  Supprimer un message
conversationsRouter.delete(
  '/:id/messages/:messageId',
  userExtractor,
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findById(req.params.id)

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      const message = conversation.messages.find(
        (m) => m.id === req.params.messageId
      )

      if (!message) {
        return res.status(404).json({ error: 'Message not found' })
      }

      // Vérifier que l'utilisateur est l'auteur du message
      if (message.senderId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' })
      }

      conversation.messages = conversation.messages.filter(
        (m) => m.id !== req.params.messageId
      )

      await conversation.save()
      console.log('✅ Message supprimé:', req.params.messageId)

      // 📡 Émettre l'événement WebSocket
      const io = req.app.get('io')
      if (io) {
        io.to(req.params.id).emit('message:deleted', {
          conversationId: req.params.id,
          messageId: req.params.messageId,
        })
      }

      const responseConversation = normalizeConversation(conversation)
      responseConversation.messages = responseConversation.messages.map(
        (msg) => {
          try {
            return {
              ...msg,
              text: msg.text ? decryptMessage(msg.text) : '',
            }
          } catch (error) {
            console.error('⚠️ Erreur déchiffrement:', error)
            return msg
          }
        }
      )

      res.json(responseConversation)
    } catch (error) {
      console.error('❌ Erreur suppression message:', error)
      next(error)
    }
  }
)

//  Marquer les messages comme lus
conversationsRouter.patch(
  '/:id/read',
  userExtractor,
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findById(req.params.id)

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // Marquer tous les messages non lus de l'autre utilisateur comme lus
      conversation.messages.forEach((msg) => {
        if (msg.senderId !== req.user.id && !msg.read) {
          msg.read = true
        }
      })

      await conversation.save()
      console.log('✅ Messages marqués comme lus dans:', req.params.id)

      // Émettre l'événement WebSocket
      const io = req.app.get('io')
      if (io) {
        io.to(req.params.id).emit('messages:read:update', {
          conversationId: req.params.id,
          userId: req.user.id,
        })
      }

      //  AJOUT: Normaliser et déchiffrer les messages avant de renvoyer
      const responseConversation = normalizeConversation(conversation)
      responseConversation.messages = responseConversation.messages.map(
        (msg) => {
          try {
            return {
              ...msg,
              text: msg.text ? decryptMessage(msg.text) : '', // 🆕 Déchiffrer
            }
          } catch (error) {
            console.error('⚠️ Erreur déchiffrement:', error)
            return msg
          }
        }
      )

      res.json(responseConversation)
    } catch (error) {
      console.error('❌ Erreur marquage messages lus:', error)
      next(error)
    }
  }
)

//  Supprimer une conversation (suppression logique)
conversationsRouter.delete('/:id', userExtractor, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    if (
      conversation.user1Id !== req.user.id &&
      conversation.user2Id !== req.user.id
    ) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Ajouter l'utilisateur à deletedFor
    if (!conversation.deletedFor.includes(req.user.id)) {
      conversation.deletedFor.push(req.user.id)
    }

    // Si les deux utilisateurs ont supprimé, supprimer définitivement
    if (
      conversation.deletedFor.includes(conversation.user1Id) &&
      conversation.deletedFor.includes(conversation.user2Id)
    ) {
      await Conversation.findByIdAndDelete(req.params.id)
      console.log('✅ Conversation supprimée définitivement:', req.params.id)
      return res.status(204).end()
    }

    await conversation.save()
    console.log('✅ Conversation supprimée pour:', req.user.id)

    res.status(204).end()
  } catch (error) {
    console.error('❌ Erreur suppression conversation:', error)
    next(error)
  }
})

// Route pour récupérer le nombre de notifications
conversationsRouter.get(
  '/notifications/unread',
  userExtractor,
  async (req, res, next) => {
    try {
      const userId = req.user.id

      const conversations = await Conversation.find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
        deletedFor: { $ne: userId },
      })

      let totalUnread = 0

      conversations.forEach((conv) => {
        const unreadMessages = conv.messages.filter(
          (msg) => msg.senderId !== userId && !msg.read
        )
        totalUnread += unreadMessages.length
      })

      res.json({ totalUnread })
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error)
      next(error)
    }
  }
)

module.exports = conversationsRouter
