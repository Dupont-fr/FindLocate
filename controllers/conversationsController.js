const conversationsRouter = require('express').Router()
const Conversation = require('../models/conversation')
const { userExtractor } = require('../utils/middleware')

// 📌 Récupérer toutes les conversations d'un utilisateur
conversationsRouter.get('/', userExtractor, async (req, res, next) => {
  try {
    const userId = req.user.id

    // Chercher les conversations où l'utilisateur est user1 OU user2
    const conversations = await Conversation.find({
      $or: [{ user1Id: userId }, { user2Id: userId }],
      deletedFor: { $ne: userId }, // Exclure les conversations supprimées
    }).sort({ lastMessageTime: -1 })

    // Transformer pour afficher le bon participant
    const transformedConversations = conversations.map((conv) => {
      const isUser1 = conv.user1Id === userId

      return {
        ...conv.toJSON(),
        participantId: isUser1 ? conv.user2Id : conv.user1Id,
        participantName: isUser1 ? conv.user2Name : conv.user1Name,
        participantAvatar: isUser1 ? conv.user2Avatar : conv.user1Avatar,
        unreadCount: conv.messages.filter(
          (msg) => msg.senderId !== userId && !msg.read
        ).length,
      }
    })

    res.json(transformedConversations)
  } catch (error) {
    console.error('❌ Erreur récupération conversations:', error)
    next(error)
  }
})

// 📌 Récupérer une conversation spécifique
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

    res.json(conversation)
  } catch (error) {
    console.error('❌ Erreur récupération conversation:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid conversation ID' })
    }
    next(error)
  }
})

// 📌 Créer une nouvelle conversation ou récupérer une existante
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

      return res.json(conversation)
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
    console.log('✅ Nouvelle conversation créée:', savedConversation.id)

    res.status(201).json(savedConversation)
  } catch (error) {
    console.error('❌ Erreur création conversation:', error)
    next(error)
  }
})

// 📌 Ajouter un message à une conversation
conversationsRouter.post(
  '/:id/messages',
  userExtractor,
  async (req, res, next) => {
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

      const { text, mediaType, mediaUrl, mediaName, mediaSize } = req.body

      // ✅ Validation: soit du texte, soit un média
      if (!text?.trim() && !mediaUrl) {
        return res
          .status(400)
          .json({ error: 'Message text or media is required' })
      }

      const newMessage = {
        id: Date.now().toString(),
        senderId: req.user.id,
        senderName: `${req.user.firstName} ${req.user.lastName}`,
        senderAvatar: req.user.profilePicture,
        text: text?.trim() || '',
        // ✅ Ajout des champs média
        mediaType: mediaType || null,
        mediaUrl: mediaUrl || '',
        mediaName: mediaName || '',
        mediaSize: mediaSize || 0,
        read: false,
        createdAt: new Date(),
      }

      conversation.messages.push(newMessage)
      conversation.lastMessage = text?.trim() || `[${mediaType || 'Media'}]`
      conversation.lastMessageTime = new Date()

      const updatedConversation = await conversation.save()
      console.log('✅ Message ajouté à la conversation:', conversation.id)

      // 📡 Émettre l'événement WebSocket
      const io = req.app.get('io')
      if (io) {
        io.to(req.params.id).emit('message:receive', {
          conversationId: req.params.id,
          message: newMessage,
        })
      }

      res.json(updatedConversation)
    } catch (error) {
      console.error('❌ Erreur ajout message:', error)
      next(error)
    }
  }
)

// 📌 Modifier un message
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

      message.text = text.trim()
      message.updatedAt = new Date()

      await conversation.save()
      console.log('✅ Message modifié:', req.params.messageId)

      // 📡 Émettre l'événement WebSocket
      const io = req.app.get('io')
      if (io) {
        io.to(req.params.id).emit('message:updated', {
          conversationId: req.params.id,
          messageId: req.params.messageId,
          text: text.trim(),
        })
      }

      res.json(conversation)
    } catch (error) {
      console.error('❌ Erreur modification message:', error)
      next(error)
    }
  }
)

// 📌 Supprimer un message
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

      res.json(conversation)
    } catch (error) {
      console.error('❌ Erreur suppression message:', error)
      next(error)
    }
  }
)

// 📌 Marquer les messages comme lus
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

      // 📡 Émettre l'événement WebSocket
      const io = req.app.get('io')
      if (io) {
        io.to(req.params.id).emit('messages:read:update', {
          conversationId: req.params.id,
          userId: req.user.id,
        })
      }

      res.json(conversation)
    } catch (error) {
      console.error('❌ Erreur marquage messages lus:', error)
      next(error)
    }
  }
)

// 📌 Supprimer une conversation (suppression logique)
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

module.exports = conversationsRouter
