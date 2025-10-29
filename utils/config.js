require('dotenv').config()

const PORT = process.env.PORT || 3003
const MONGODB_URI = process.env.MONGODB_URI
const JWT_SECRET = process.env.JWT_SECRET
const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASS = process.env.EMAIL_PASS
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI must be defined in .env file')
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in .env file')
}

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn(
    'Warning: EMAIL_USER and EMAIL_PASS not configured. Email features will not work.'
  )
}

module.exports = {
  MONGODB_URI,
  PORT,
  JWT_SECRET,
  EMAIL_USER,
  EMAIL_PASS,
  FRONTEND_URL,
}
