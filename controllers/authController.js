const authRouter = require('express').Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/user')
const config = require('../utils/config')
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail, //  ajouté
} = require('../utils/emailConfig')

//  Générer un code de vérification à 6 chiffres
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phonenumber,
      password,
      bio,
      profilePicture,
    } = req.body

    //  Validation du mot de passe
    if (!password || password.length < 6)
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters long' })
    if (!/[A-Z]/.test(password))
      return res
        .status(400)
        .json({ error: 'Password must contain at least one uppercase letter' })
    if (!/[a-z]/.test(password))
      return res
        .status(400)
        .json({ error: 'Password must contain at least one lowercase letter' })
    if (!/[0-9]/.test(password))
      return res
        .status(400)
        .json({ error: 'Password must contain at least one number' })
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
      return res
        .status(400)
        .json({ error: 'Password must contain at least one special character' })

    //  Vérifier les doublons (email ou téléphone)
    const existingEmail = await User.findOne({ email })
    if (existingEmail)
      return res.status(400).json({ error: 'This email is already registered' })

    const existingPhone = await User.findOne({ phonenumber })
    if (existingPhone)
      return res
        .status(400)
        .json({ error: 'This phone number is already used' })

    //  Hash du mot de passe
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    //  Générer un code de vérification (expire dans 5 minutes)
    const verificationCode = generateVerificationCode()
    const verificationCodeExpires = new Date(Date.now() + 5 * 60 * 1000)

    //  Créer le nouvel utilisateur
    const user = new User({
      firstName,
      lastName,
      email,
      phonenumber,
      passwordHash,
      bio: bio || '',
      profilePicture:
        profilePicture ||
        'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      isVerified: false,
      verificationCode,
      verificationCodeExpires,
    })

    const savedUser = await user.save()

    //  Envoyer l'email de vérification
    try {
      await sendVerificationEmail(email, verificationCode, firstName)
    } catch (emailError) {
      await User.findByIdAndDelete(savedUser._id)
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again.',
      })
    }

    res.status(201).json({
      message:
        'Registration successful! Please check your email for the verification code.',
      email: savedUser.email,
      userId: savedUser._id,
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body

    if (!email || !code)
      return res.status(400).json({ error: 'Email and code are required' })

    const user = await User.findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: Date.now() },
    })

    if (!user)
      return res
        .status(400)
        .json({ error: 'Invalid or expired verification code' })

    //  Marquer comme vérifié
    user.isVerified = true
    user.verificationCode = undefined
    user.verificationCodeExpires = undefined
    await user.save()

    //  Envoyer un email de bienvenue
    try {
      await sendWelcomeEmail(user.email, user.firstName)
      console.log('✅ Welcome email sent to', user.email)
    } catch (err) {
      console.error('❌ Failed to send welcome email:', err.message)
    }

    //  Générer un token JWT
    const userForToken = { id: user._id, email: user.email }
    const token = jwt.sign(userForToken, config.JWT_SECRET, { expiresIn: '7d' })

    res.status(200).json({
      message: 'Email verified successfully! Welcome to FindLocate 🎉',
      token,
      user: user.toJSON(),
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.isVerified)
      return res.status(400).json({ error: 'Email is already verified' })

    const verificationCode = generateVerificationCode()
    const verificationCodeExpires = new Date(Date.now() + 5 * 60 * 1000)

    user.verificationCode = verificationCode
    user.verificationCodeExpires = verificationCodeExpires
    await user.save()

    await sendVerificationEmail(email, verificationCode, user.firstName)

    res.status(200).json({
      message: 'Verification code sent! Please check your inbox.',
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })

    if (!user)
      return res.status(401).json({ error: 'Invalid email or password' })

    if (!user.isVerified)
      return res.status(403).json({
        error: 'Please verify your email before logging in',
        needsVerification: true,
      })

    const passwordCorrect = await bcrypt.compare(password, user.passwordHash)
    if (!passwordCorrect)
      return res.status(401).json({ error: 'Invalid email or password' })

    const userForToken = { id: user._id, email: user.email }
    const token = jwt.sign(userForToken, config.JWT_SECRET, { expiresIn: '7d' })

    res.status(200).json({ token, user: user.toJSON() })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const user = await User.findOne({ email })
    if (!user)
      return res.status(200).json({
        message:
          'If an account exists with this email, a password reset code has been sent.',
      })

    const resetCode = generateVerificationCode()
    const resetCodeExpires = new Date(Date.now() + 5 * 60 * 1000)

    user.resetPasswordCode = resetCode
    user.resetCodeExpires = resetCodeExpires
    await user.save()

    await sendPasswordResetEmail(email, resetCode, user.firstName)

    res.status(200).json({
      message:
        'If an account exists with this email, a password reset code has been sent.',
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/verify-reset-code', async (req, res, next) => {
  try {
    const { email, code } = req.body
    if (!email || !code)
      return res.status(400).json({ error: 'Email and code are required' })

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetCodeExpires: { $gt: Date.now() },
    })

    if (!user)
      return res.status(400).json({ error: 'Invalid or expired reset code' })

    res.status(200).json({ message: 'Code is valid', email: user.email })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, password } = req.body
    if (!email || !code || !password)
      return res
        .status(400)
        .json({ error: 'Email, code and password are required' })

    if (password.length < 6)
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters long' })

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetCodeExpires: { $gt: Date.now() },
    })

    if (!user)
      return res.status(400).json({ error: 'Invalid or expired reset code' })

    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    user.passwordHash = passwordHash
    user.resetPasswordCode = undefined
    user.resetCodeExpires = undefined
    await user.save()

    res.status(200).json({
      message: 'Password has been reset successfully! You can now login.',
    })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/verify', async (req, res, next) => {
  try {
    const authorization = req.get('authorization')
    if (!authorization || !authorization.toLowerCase().startsWith('bearer '))
      return res.status(401).json({ error: 'Token missing or invalid' })

    const token = authorization.substring(7)
    const decodedToken = jwt.verify(token, config.JWT_SECRET)
    if (!decodedToken.id)
      return res.status(401).json({ error: 'Token invalid' })

    const user = await User.findById(decodedToken.id)
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (!user.isVerified)
      return res.status(403).json({ error: 'Email not verified' })

    res.status(200).json({ user: user.toJSON() })
  } catch (error) {
    next(error)
  }
})

module.exports = authRouter
