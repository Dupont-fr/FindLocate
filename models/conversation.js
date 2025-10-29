const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String, default: '' },
  text: { type: String, default: '' },
  // ✅ AJOUT: Support des médias
  mediaType: {
    type: String,
    enum: ['text', 'image', 'video', 'document', null],
    default: null,
  },
  mediaUrl: { type: String, default: '' },
  mediaName: { type: String, default: '' }, // Nom du fichier
  mediaSize: { type: Number, default: 0 }, // Taille en bytes
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
})

const conversationSchema = new mongoose.Schema({
  user1Id: {
    type: String,
    required: true,
    index: true,
  },
  user1Name: {
    type: String,
    required: true,
  },
  user1Avatar: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  },
  user2Id: {
    type: String,
    required: true,
    index: true,
  },
  user2Name: {
    type: String,
    required: true,
  },
  user2Avatar: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  },
  messages: [messageSchema],
  lastMessage: {
    type: String,
    default: '',
  },
  lastMessageTime: {
    type: Date,
    default: Date.now,
  },
  deletedFor: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Index composé pour rechercher efficacement les conversations
conversationSchema.index({ user1Id: 1, user2Id: 1 })
conversationSchema.index({ user2Id: 1, user1Id: 1 })

conversationSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  },
})

module.exports = mongoose.model('Conversation', conversationSchema)
