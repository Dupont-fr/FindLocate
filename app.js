// 🩵 Correction Windows / proxy : désactive la vérification TLS globale en dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const config = require('./utils/config')
const logger = require('./utils/logger')
const middleware = require('./utils/middleware')
const authRouter = require('./controllers/authController')
const usersRouter = require('./controllers/usersController')
const postsRouter = require('./controllers/postsController')
const conversationsRouter = require('./controllers/conversationsController')
const { testEmailConnection } = require('./utils/emailConfig')

const app = express()

// ✅ Connexion à MongoDB
mongoose
  .connect(config.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => {
    console.error('❌ Error connecting to MongoDB:', error.message)
    process.exit(1) // Stoppe le serveur si la connexion échoue
  })

// ✅ Middlewares globaux
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// ✅ Ignorer les logs pour les requêtes Socket.IO
app.use((req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next()
  next()
})

// ✅ Logger normal (pour toutes les autres routes)
app.use(middleware.requestLogger)

// ✅ Routes API
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/posts', postsRouter)

// ✅ Route de test santé
app.get('/api/health', (req, res) => {
  res.send({ status: 'ok', timestamp: new Date().toISOString() })
})

// ✅ Gestion des erreurs
app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app
