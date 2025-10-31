const crypto = require('crypto')
const config = require('./config')

// 🔐 Configuration du chiffrement AES-256
const ALGORITHM = 'aes-256-cbc'
const SECRET_KEY = config.MESSAGE_SECRET || config.JWT_SECRET // Utilise une clé dédiée

// 🆕 Générer une clé de 32 bytes à partir du secret
const getKey = () => {
  return crypto.createHash('sha256').update(SECRET_KEY).digest()
}

/**
 * 🔒 Chiffrer un message
 * @param {string} text - Texte en clair
 * @returns {string} - Texte chiffré (format: iv:encrypted)
 */
const encryptMessage = (text) => {
  try {
    if (!text) return ''

    // 🆕 Générer un IV (Initialization Vector) aléatoire
    const iv = crypto.randomBytes(16)
    const key = getKey()

    // 🆕 Créer le cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // 🆕 Chiffrer le texte
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // 🆕 Retourner IV + texte chiffré (séparés par :)
    return `${iv.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('❌ Erreur chiffrement message:', error)
    throw new Error('Failed to encrypt message')
  }
}

/**
 * 🔓 Déchiffrer un message
 * @param {string} encryptedData - Texte chiffré (format: iv:encrypted)
 * @returns {string} - Texte en clair
 */
const decryptMessage = (encryptedData) => {
  try {
    if (!encryptedData) return ''

    // 🆕 Séparer l'IV du texte chiffré
    const [ivHex, encrypted] = encryptedData.split(':')

    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format')
    }

    const iv = Buffer.from(ivHex, 'hex')
    const key = getKey()

    // 🆕 Créer le decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

    // 🆕 Déchiffrer le texte
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('❌ Erreur déchiffrement message:', error)
    throw new Error('Failed to decrypt message')
  }
}

module.exports = {
  encryptMessage,
  decryptMessage,
}
