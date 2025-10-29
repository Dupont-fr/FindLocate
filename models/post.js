const mongoose = require('mongoose')

const replySchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: '' },
  text: { type: String, required: true },
  likes: [
    {
      userId: String,
      userName: String,
      userAvatar: String,
    },
  ],
  createdAt: { type: Date, default: Date.now },
})

const commentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: '' },
  text: { type: String, required: true },
  likes: [
    {
      userId: String,
      userName: String,
      userAvatar: String,
    },
  ],
  replies: [replySchema],
  createdAt: { type: Date, default: Date.now },
})

const postSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userAvatar: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  },
  content: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 2000,
  },
  price: {
    type: String,
    required: true,
  },
  region: {
    type: String,
    required: true,
  },
  ville: {
    type: String,
    required: true,
  },
  quartier: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['appartement', 'studio', 'maison', 'chambre'],
  },
  images: [String],
  videos: [String],
  likes: [
    {
      userId: String,
      userName: String,
      userAvatar: String,
    },
  ],
  comments: [commentSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

postSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  },
})

module.exports = mongoose.model('Post', postSchema)
