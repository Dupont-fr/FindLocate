const usersRouter = require('express').Router()
const bcrypt = require('bcrypt')
const User = require('../models/user')
const { userExtractor } = require('../utils/middleware')
// 🆕 AJOUT: Import des fonctions d'envoi d'emails
const {
  sendProfileUpdateEmail,
  sendAccountDeletionEmail,
} = require('../utils/emailConfig')
// 🆕 AJOUT: Import du service socket pour les notifications en temps réel
const { getIO } = require('../utils/socketConfig')

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

    // 🆕 AJOUT: Objet pour tracker les champs modifiés
    const updatedFields = {}

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

      // Validation complète du nouveau mot de passe
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

      // 🆕 AJOUT: Tracker le changement de mot de passe
      updatedFields.password = true
    }

    // Mettre à jour les autres champs
    if (firstName !== undefined) {
      user.firstName = firstName
      updatedFields.firstName = true // 🆕 Tracker
    }
    if (lastName !== undefined) {
      user.lastName = lastName
      updatedFields.lastName = true // 🆕 Tracker
    }
    if (bio !== undefined) {
      user.bio = bio
      updatedFields.bio = true // 🆕 Tracker
    }
    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture
      updatedFields.profilePicture = true // 🆕 Tracker
    }

    const updatedUser = await user.save()
    console.log('✅ Utilisateur mis à jour avec succès')

    // 🆕 AJOUT: Envoyer email de confirmation si des champs ont été modifiés
    if (Object.keys(updatedFields).length > 0) {
      try {
        // 🆕 Ajouter l'ID utilisateur pour le lien dans l'email
        updatedFields.userId = user._id

        await sendProfileUpdateEmail(
          user.email,
          `${user.firstName} ${user.lastName}`,
          updatedFields
        )
        console.log('✅ Profile update email sent to', user.email)
      } catch (emailError) {
        console.error(
          '❌ Failed to send profile update email:',
          emailError.message
        )
        // 🆕 NOTE: On continue même si l'email échoue (non bloquant)
      }
    }

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

    // 🆕 AJOUT: Récupérer les infos de l'utilisateur avant suppression
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 🆕 AJOUT: Sauvegarder email et nom avant suppression
    const userEmail = user.email
    const userName = `${user.firstName} ${user.lastName}`

    // Supprimer l'utilisateur
    await User.findByIdAndDelete(req.params.id)
    console.log('✅ Utilisateur supprimé avec succès')

    // 🆕 AJOUT: Envoyer email de confirmation de suppression
    try {
      await sendAccountDeletionEmail(userEmail, userName)
      console.log('✅ Account deletion email sent to', userEmail)
    } catch (emailError) {
      console.error(
        '❌ Failed to send account deletion email:',
        emailError.message
      )
      // 🆕 NOTE: On continue même si l'email échoue (non bloquant)
    }

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

// 🆕 NOUVELLE ROUTE: Envoyer une demande d'ami (avec notification en temps réel)
usersRouter.post(
  '/:id/friend-request',
  userExtractor,
  async (req, res, next) => {
    try {
      const targetUserId = req.params.id
      const requesterId = req.user.id

      // Vérifier qu'on n'envoie pas une demande à soi-même
      if (targetUserId === requesterId) {
        return res
          .status(400)
          .json({ error: 'Cannot send friend request to yourself' })
      }

      const targetUser = await User.findById(targetUserId)
      const requester = await User.findById(requesterId)

      if (!targetUser || !requester) {
        return res.status(404).json({ error: 'User not found' })
      }

      // 🆕 AJOUT: Envoyer notification en temps réel
      try {
        const io = getIO()

        const notification = {
          type: 'friend-request',
          senderId: requesterId,
          senderName: `${requester.firstName} ${requester.lastName}`,
          senderAvatar: requester.profilePicture || '/default-avatar.png',
          message: `${requester.firstName} ${requester.lastName} vous a envoyé une demande d'ami`,
          timestamp: new Date().toISOString(),
          recipientId: targetUserId,
        }

        // Émettre la notification à l'utilisateur cible
        io.to(`user_${targetUserId}`).emit(
          'notification:friend-request',
          notification
        )
        console.log(
          `🔔 Notification de demande d'ami envoyée à user_${targetUserId}`
        )
      } catch (socketError) {
        console.error(
          "❌ Erreur lors de l'envoi de la notification socket:",
          socketError.message
        )
        // 🆕 NOTE: On continue même si la notification socket échoue
      }

      res.json({ message: 'Friend request sent successfully' })
    } catch (error) {
      next(error)
    }
  }
)

// 🆕 NOUVELLE ROUTE: Accepter une demande d'ami (avec notification en temps réel)
usersRouter.post(
  '/:id/accept-friend',
  userExtractor,
  async (req, res, next) => {
    try {
      const requesterId = req.params.id // Celui qui a envoyé la demande
      const accepterId = req.user.id // Celui qui accepte

      const requester = await User.findById(requesterId)
      const accepter = await User.findById(accepterId)

      if (!requester || !accepter) {
        return res.status(404).json({ error: 'User not found' })
      }

      // 🆕 AJOUT: Envoyer notification en temps réel au demandeur
      try {
        const io = getIO()

        const notification = {
          type: 'friend-accepted',
          senderId: accepterId,
          senderName: `${accepter.firstName} ${accepter.lastName}`,
          senderAvatar: accepter.profilePicture || '/default-avatar.png',
          message: `${accepter.firstName} ${accepter.lastName} a accepté votre demande d'ami`,
          timestamp: new Date().toISOString(),
          recipientId: requesterId,
        }

        // Émettre la notification au demandeur original
        io.to(`user_${requesterId}`).emit(
          'notification:friend-accepted',
          notification
        )
        console.log(
          `🔔 Notification d'acceptation d'ami envoyée à user_${requesterId}`
        )
      } catch (socketError) {
        console.error(
          "❌ Erreur lors de l'envoi de la notification socket:",
          socketError.message
        )
        // 🆕 NOTE: On continue même si la notification socket échoue
      }

      res.json({ message: 'Friend request accepted successfully' })
    } catch (error) {
      next(error)
    }
  }
)

module.exports = usersRouter
