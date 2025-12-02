const jwt = require('jsonwebtoken')
const User = require('../models/user')
const config = require('./config')

require('dotenv').config()

const JWT_SECRET = process.env.JWT_SECRET

const adminExtractor = async (req, res, next) => {
  try {
    const authorization = req.get('authorization')

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Token missing or invalid' })
    }

    const token = authorization.substring(7)

    if (!process.env.JWT_SECRET) {
      console.error('❌ ERREUR CRITIQUE : JWT_SECRET non défini dans .env')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!decodedToken.id) {
      return res.status(401).json({ error: 'Token invalid' })
    }

    //  Récupérer l'utilisateur depuis la DB
    const user = await User.findById(decodedToken.id)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    //  Vérifier si l'utilisateur est un admin
    if (user.role !== 'admin') {
      console.log(
        `⚠️ Tentative d'accès admin refusée pour l'utilisateur: ${user.email}`
      )
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.',
      })
    }

    console.log(`✅ Admin authentifié: ${user.email}`)

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    }

    next()
  } catch (error) {
    console.error('❌ Admin middleware error:', error)

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' })
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }

    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { adminExtractor }
