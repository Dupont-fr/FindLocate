// const usersRouter = require('express').Router()
// const User = require('../models/user')
// const { userExtractor } = require('../utils/middleware')

// // Récupérer tous les utilisateurs
// usersRouter.get('/', async (req, res, next) => {
//   try {
//     const users = await User.find({}).populate('posts', {
//       title: 1,
//       content: 1,
//       createdAt: 1,
//     })
//     res.json(users)
//   } catch (error) {
//     next(error)
//   }
// })

// // Récupérer un utilisateur par ID
// usersRouter.get('/:id', async (req, res, next) => {
//   try {
//     const user = await User.findById(req.params.id).populate('posts')
//     if (user) {
//       res.json(user)
//     } else {
//       res.status(404).json({ error: 'User not found' })
//     }
//   } catch (error) {
//     next(error)
//   }
// })

// // Mettre à jour un utilisateur
// usersRouter.put('/:id', userExtractor, async (req, res, next) => {
//   try {
//     const { firstName, lastName, bio, profilePicture } = req.body

//     if (req.user.id !== req.params.id) {
//       return res.status(403).json({ error: 'Permission denied' })
//     }

//     const updatedData = {
//       firstName,
//       lastName,
//       bio,
//       profilePicture,
//     }

//     Object.keys(updatedData).forEach(
//       (key) => updatedData[key] === undefined && delete updatedData[key]
//     )

//     let updatedUser
//     try {
//       updatedUser = await User.findByIdAndUpdate(req.params.id, updatedData, {
//         new: true,
//         runValidators: true,
//       })
//     } catch (error) {
//       // 🆕 Gestion des erreurs de duplication (au cas où)
//       if (error.code === 11000) {
//         const field = Object.keys(error.keyValue)[0]
//         return res.status(400).json({ error: `${field} already exists` })
//       }
//       throw error
//     }

//     if (updatedUser) {
//       res.json(updatedUser)
//     } else {
//       res.status(404).json({ error: 'User not found' })
//     }
//   } catch (error) {
//     next(error)
//   }
// })

// // Supprimer un utilisateur
// usersRouter.delete('/:id', userExtractor, async (req, res, next) => {
//   try {
//     if (req.user.id !== req.params.id) {
//       return res.status(403).json({ error: 'Permission denied' })
//     }

//     await User.findByIdAndDelete(req.params.id)
//     res.status(204).end()
//   } catch (error) {
//     next(error)
//   }
// })

// module.exports = usersRouter

const usersRouter = require('express').Router()
const bcrypt = require('bcrypt')
const User = require('../models/user')
const { userExtractor } = require('../utils/middleware')

// Récupérer tous les utilisateurs
usersRouter.get('/', async (req, res, next) => {
  try {
    const users = await User.find({}).populate('posts', {
      title: 1,
      content: 1,
      createdAt: 1,
    })
    res.json(users)
  } catch (error) {
    next(error)
  }
})

// Récupérer un utilisateur par ID
usersRouter.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('posts')

    if (user) {
      res.json(user)
    } else {
      res.status(404).json({ error: 'User not found' })
    }
  } catch (error) {
    next(error)
  }
})

// Mettre à jour un utilisateur (requiert authentification)
usersRouter.put('/:id', userExtractor, async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      bio,
      profilePicture,
      currentPassword,
      newPassword,
    } = req.body

    // Vérifier que l'utilisateur modifie son propre profil
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Si l'utilisateur veut changer son mot de passe
    if (currentPassword && newPassword) {
      console.log('🔐 Tentative de changement de mot de passe...')

      // Vérifier le mot de passe actuel
      const passwordCorrect = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      )

      if (!passwordCorrect) {
        console.log('❌ Mot de passe actuel incorrect')
        return res.status(400).json({ error: 'Current password is incorrect' })
      }

      console.log('✅ Mot de passe actuel correct')

      // Valider le nouveau mot de passe (longueur minimale)
      if (newPassword.length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters long',
        })
      }

      // Validation complète du nouveau mot de passe (optionnel - correspond au frontend)
      const hasUpperCase = /[A-Z]/.test(newPassword)
      const hasLowerCase = /[a-z]/.test(newPassword)
      const hasNumber = /[0-9]/.test(newPassword)
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)

      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        return res.status(400).json({
          error:
            'Password must contain uppercase, lowercase, number and special character',
        })
      }

      // Hasher le nouveau mot de passe
      const saltRounds = 10
      user.passwordHash = await bcrypt.hash(newPassword, saltRounds)
      console.log('✅ Nouveau mot de passe hashé avec succès')
    }

    // Mettre à jour les autres champs
    if (firstName !== undefined) user.firstName = firstName
    if (lastName !== undefined) user.lastName = lastName
    if (bio !== undefined) user.bio = bio
    if (profilePicture !== undefined) user.profilePicture = profilePicture

    const updatedUser = await user.save()
    console.log('✅ Utilisateur mis à jour avec succès')

    res.json(updatedUser.toJSON())
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error)
    next(error)
  }
})

// Supprimer un utilisateur (requiert authentification)
usersRouter.delete('/:id', userExtractor, async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur supprime son propre compte
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    await User.findByIdAndDelete(req.params.id)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

module.exports = usersRouter
