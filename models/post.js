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
  reports: [
    {
      reason: {
        type: String,
        required: true,
      },
      additionalInfo: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  isVisible: {
    type: Boolean,
    default: true,
  },
  occupancyStatus: {
    isOccupied: {
      type: Boolean,
      default: false,
    },
    occupiedAt: {
      type: Date,
    },
    occupiedBy: {
      name: String,
      contact: String,
    },
    occupiedNote: {
      type: String,
      maxlength: 200,
    },
    history: [
      {
        status: {
          type: String,
          enum: ['available', 'occupied'],
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: String,
        },
        note: String,
      },
    ],
  },
})

postSchema.virtual('isAvailable').get(function () {
  return !this.occupancyStatus.isOccupied
})

postSchema.methods.markAsOccupied = function (occupiedBy, note) {
  this.occupancyStatus.isOccupied = true
  this.occupancyStatus.occupiedAt = new Date()
  this.occupancyStatus.occupiedBy = occupiedBy || { name: '', contact: '' }
  this.occupancyStatus.occupiedNote = note || ''

  this.occupancyStatus.history.push({
    status: 'occupied',
    changedAt: new Date(),
    changedBy: this.userId,
    note: note || 'Bien marqué comme occupé',
  })

  return this.save()
}

postSchema.methods.markAsAvailable = function (note) {
  this.occupancyStatus.isOccupied = false
  this.occupancyStatus.occupiedAt = null
  this.occupancyStatus.occupiedBy = { name: '', contact: '' }
  this.occupancyStatus.occupiedNote = ''

  this.occupancyStatus.history.push({
    status: 'available',
    changedAt: new Date(),
    changedBy: this.userId,
    note: note || 'Bien marqué comme disponible',
  })

  return this.save()
}

postSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  },
  virtuals: true,
})

module.exports = mongoose.model('Post', postSchema)
