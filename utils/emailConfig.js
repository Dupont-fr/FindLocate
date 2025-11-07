const sgMail = require('@sendgrid/mail')
const config = require('./config')

if (config.SENDGRID_API_KEY) {
  sgMail.setApiKey(config.SENDGRID_API_KEY)

  sgMail.setTimeout(80000) // 30 secondes

  console.log('✅ SendGrid API key configured')
} else {
  console.warn(
    '⚠️ WARNING: SENDGRID_API_KEY not configured. Email features will not work.'
  )
}

const sendEmail = async (to, subject, html, retries = 3) => {
  //  Validation des paramètres
  if (!config.SENDGRID_API_KEY) {
    console.error('❌ SendGrid API key not configured')
    throw new Error('Email service not configured')
  }

  if (!config.EMAIL_USER) {
    console.error('❌ EMAIL_USER not configured')
    throw new Error('Sender email not configured')
  }

  if (!to || !subject || !html) {
    console.error('❌ Missing required email parameters')
    throw new Error('Invalid email parameters')
  }

  //  Construction du message avec validation
  const msg = {
    to: to.trim(),
    from: {
      email: config.EMAIL_USER,
      name: 'FindLocate',
    },
    subject: subject,
    html: html,

    trackingSettings: {
      clickTracking: {
        enable: false,
      },
      openTracking: {
        enable: false,
      },
    },
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `📤 Attempting to send email to ${to} (attempt ${attempt}/${retries})`
      )

      const response = await sgMail.send(msg)

      console.log(`✅ Email sent successfully to ${to}`)

      return {
        success: true,
        messageId: response[0]?.headers['x-message-id'],
        statusCode: response[0]?.statusCode,
      }
    } catch (error) {
      console.error(
        `❌ SendGrid Error (attempt ${attempt}/${retries}):`,
        error.message
      )

      // 🆕 Log détaillé des erreurs
      if (error.response) {
        console.error('📋 Error details:', {
          statusCode: error.code,
          body: error.response?.body,
        })
      }

      //  Si c'est la dernière tentative, on lance l'erreur
      if (attempt === retries) {
        let errorMessage = 'Failed to send email'

        if (error.code === 401) {
          errorMessage = 'Invalid SendGrid API key'
        } else if (error.code === 403) {
          errorMessage =
            'SendGrid API key does not have permission to send emails'
        } else if (error.code === 400) {
          errorMessage = 'Invalid email parameters or unverified sender'
        } else if (
          error.message.includes('network') ||
          error.message.includes('socket')
        ) {
          errorMessage =
            'Network connection error. Please check your internet connection.'
        }

        throw new Error(errorMessage)
      }

      //  Attendre avant de réessayer (délai exponentiel)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`⏳ Waiting ${delay}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

// Test de connexion SendGrid
const testEmailConnection = async () => {
  try {
    if (!config.SENDGRID_API_KEY) {
      console.error('❌ SendGrid API key not configured')
      return false
    }

    //  Test simple sans envoyer d'email
    console.log('✅ SendGrid configuration OK - Ready to send')
    return true
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error.message)
    return false
  }
}

//  FONCTION INCHANGÉE - Envoi email de vérification
const sendVerificationEmail = async (email, code, firstName) => {
  const subject = '✅ Your FindLocate Verification Code'
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="background: linear-gradient(135deg,#667eea,#764ba2); color:white; padding:15px; text-align:center; border-radius:10px 10px 0 0;">
        Welcome to FindLocate 🎉
      </h2>
      <div style="padding:25px; background:#f9f9f9; border-radius:0 0 10px 10px;">
        <p>Hello <strong>${firstName}</strong>,</p>
        <p>Thank you for registering! Here's your verification code:</p>
        <div style="background:white; border:3px dashed #667eea; text-align:center; padding:15px; border-radius:10px;">
          <span style="font-size:32px; font-weight:bold; color:#667eea; letter-spacing:6px;">${code}</span>
        </div>
        <p style="margin-top:20px;">⏰ This code will expire in <strong>5 minutes</strong>.</p>
        <p>If you didn't sign up, please ignore this email.</p>
        <p>— The FindLocate Team</p>
        <p>© ${new Date().getFullYear()} FindLocate. All rights reserved.</p>
        <p>You can contact dupontdjeague@gmail.com, for more informations about FindLocate.</p>
      </div>
    </div>
  `

  await sendEmail(email, subject, html)
  console.log('📩 Verification email sent to:', email)
}

// ✅ FONCTION INCHANGÉE - Envoi email de réinitialisation mot de passe
const sendPasswordResetEmail = async (email, code, firstName) => {
  const subject = '🔐 Password Reset Code - FindLocate'
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="background: linear-gradient(135deg,#f093fb,#f5576c); color:white; padding:15px; text-align:center; border-radius:10px 10px 0 0;">
        Password Reset Request
      </h2>
      <div style="padding:25px; background:#f9f9f9; border-radius:0 0 10px 10px;">
        <p>Hello <strong>${firstName}</strong>,</p>
        <p>We received a request to reset your password. Here's your code:</p>
        <div style="background:white; border:3px dashed #f5576c; text-align:center; padding:15px; border-radius:10px;">
          <span style="font-size:32px; font-weight:bold; color:#f5576c; letter-spacing:6px;">${code}</span>
        </div>
        <p style="margin-top:20px;">⏰ This code expires in <strong>5 minutes</strong>.</p>
        <p>If you didn't request this, you can ignore this email.</p>
        <p>— The FindLocate Team</p>
        <p>© ${new Date().getFullYear()} FindLocate. All rights reserved.</p>
        <p>You can contact dupontdjeague@gmail.com, for more informations about FindLocate.</p>
      </div>
    </div>
  `

  await sendEmail(email, subject, html)
  console.log('📩 Password reset email sent to:', email)
}

// ✅ FONCTION INCHANGÉE - Envoi email de confirmation de création d'annonce
const sendPostCreatedEmail = async (userEmail, postData) => {
  const { userName, postTitle, postType, location, price } = postData

  const subject = '🎉 Votre annonce a été publiée avec succès !'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#1877f2; text-align:center;">✅ Annonce publiée avec succès</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Votre annonce a été publiée avec succès sur FindLocate !</p>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px;">
        <h3 style="color:#333;">📋 Détails de l'annonce :</h3>
        <p><strong>Type :</strong> ${postType}</p>
        <p><strong>Description :</strong> ${postTitle}</p>
        <p><strong>Localisation :</strong> ${location}</p>
        <p><strong>Prix :</strong> ${price}</p>
      </div>

      <div style="text-align:center; margin-top:25px;">
        <a href="${config.FRONTEND_URL || 'http://localhost:5173'}"
           style="background-color:#1877f2; color:white; padding:12px 30px; text-decoration:none; border-radius:6px;">
           Voir mon annonce
        </a>
      </div>

      <p style="margin-top:30px; font-size:13px; color:#666; text-align:center;">
        Vous recevez cet email car vous avez publié une annonce sur FindLocate.<br>
        Si vous n'êtes pas à l'origine de cette action, contactez-nous immédiatement.
      </p>

      <p>© ${new Date().getFullYear()} FindLocate. All rights reserved.</p>
      <p>You can contact dupontdjeague@gmail.com, for more informations about FindLocate.</p>
    </div>
  `

  await sendEmail(userEmail, subject, html)
  console.log('📩 Post created confirmation sent to:', userEmail)
}

// ✅ FONCTION INCHANGÉE - Envoi email de bienvenue
const sendWelcomeEmail = async (userEmail, userName) => {
  const subject = '👋 Bienvenue sur FindLocate !'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#1877f2; text-align:center;">Bienvenue ${userName}! 🎉</h2>
      <p>Nous sommes ravis de vous accueillir sur FindLocate, la plateforme qui facilite vos annonces immobilières.</p>
      <ul>
        <li>📝 Publiez vos annonces facilement</li>
        <li>🔍 Recherchez des logements</li>
        <li>💬 Contactez directement les propriétaires</li>
        <li>❤️ Sauvegardez vos annonces préférées</li>
        <li>🌍 Aidez-nous à agrandir la communauté</li>
      </ul>

      <div style="text-align:center; margin-top:25px;">
        <a href="${config.FRONTEND_URL || 'http://localhost:5173'}"
           style="background-color:#1877f2; color:white; padding:12px 30px; text-decoration:none; border-radius:6px;">
           Commencer maintenant
        </a>
      </div>

      <p style="margin-top:30px; font-size:13px; color:#666; text-align:center;">
        © ${new Date().getFullYear()} FindLocate. All rights reserved.<br>
        You can contact dupontdjeague@gmail.com for more information about FindLocate.
      </p>
    </div>
  `

  await sendEmail(userEmail, subject, html)
  console.log('📩 Welcome email sent to:', userEmail)
}

// ✅ FONCTION INCHANGÉE - Envoi email de connexion réussie
const sendLoginSuccessEmail = async (userEmail, userName, loginDetails) => {
  const { loginTime, ipAddress, device } = loginDetails

  const subject = '✅ Connexion réussie à votre compte FindLocate'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#28a745; text-align:center;">🔐 Connexion réussie</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Vous vous êtes connecté(e) avec succès à votre compte FindLocate.</p>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
        <h3 style="color:#333; margin-top:0;">📊 Détails de la connexion :</h3>
        <p><strong>Date et heure :</strong> ${loginTime}</p>
        <p><strong>Adresse IP :</strong> ${ipAddress || 'Non disponible'}</p>
        <p><strong>Appareil :</strong> ${device || 'Non disponible'}</p>
      </div>

      <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin:20px 0;">
        <p style="margin:0;"><strong>⚠️ Ce n'était pas vous ?</strong></p>
        <p style="margin:5px 0 0 0;">Si vous n'êtes pas à l'origine de cette connexion, veuillez réinitialiser votre mot de passe immédiatement et nous contacter.</p>
      </div>

      <div style="text-align:center; margin-top:25px;">
        <a href="${config.FRONTEND_URL}/forgot-password"
           style="background-color:#dc3545; color:white; padding:12px 30px; text-decoration:none; border-radius:6px;">
           Réinitialiser mon mot de passe
        </a>
      </div>

      <p style="margin-top:30px; font-size:13px; color:#666; text-align:center;">
        © ${new Date().getFullYear()} FindLocate. All rights reserved.<br>
        Contact: dupontdjeague@gmail.com
      </p>
    </div>
  `

  await sendEmail(userEmail, subject, html)
  console.log('📩 Login success email sent to:', userEmail)
}

// ✅ FONCTION INCHANGÉE - Envoi email de succès réinitialisation mot de passe
const sendPasswordResetSuccessEmail = async (userEmail, userName) => {
  const subject = '✅ Votre mot de passe a été réinitialisé avec succès'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#28a745; text-align:center;">🔒 Mot de passe réinitialisé</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Votre mot de passe a été réinitialisé avec succès.</p>

      <div style="background:#d4edda; border-left:4px solid #28a745; padding:15px; margin:20px 0;">
        <p style="margin:0;"><strong>✅ Action confirmée</strong></p>
        <p style="margin:5px 0 0 0;">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
      </div>

      <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin:20px 0;">
        <p style="margin:0;"><strong>⚠️ Ce n'était pas vous ?</strong></p>
        <p style="margin:5px 0 0 0;">Si vous n'avez pas demandé cette réinitialisation, contactez-nous immédiatement.</p>
      </div>

      <div style="text-align:center; margin-top:25px;">
        <a href="${config.FRONTEND_URL}/login"
           style="background-color:#1877f2; color:white; padding:12px 30px; text-decoration:none; border-radius:6px;">
           Se connecter
        </a>
      </div>

      <p style="margin-top:30px; font-size:13px; color:#666; text-align:center;">
        © ${new Date().getFullYear()} FindLocate. All rights reserved.<br>
        Contact: dupontdjeague@gmail.com
      </p>
    </div>
  `

  await sendEmail(userEmail, subject, html)
  console.log('📩 Password reset success email sent to:', userEmail)
}

// ✅ FONCTION INCHANGÉE - Envoi email de mise à jour profil
const sendProfileUpdateEmail = async (userEmail, userName, updatedFields) => {
  const fieldsList = Object.keys(updatedFields)
    .map((key) => {
      const displayNames = {
        firstName: 'Prénom',
        lastName: 'Nom',
        bio: 'Biographie',
        profilePicture: 'Photo de profil',
        password: 'Mot de passe',
      }
      return `<li>${displayNames[key] || key}</li>`
    })
    .join('')

  const subject = '✅ Votre profil a été mis à jour'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#1877f2; text-align:center;">📝 Profil mis à jour</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Les informations suivantes de votre profil ont été mises à jour avec succès :</p>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
        <h3 style="color:#333; margin-top:0;">✏️ Champs modifiés :</h3>
        <ul style="margin:10px 0; padding-left:20px;">
          ${fieldsList}
        </ul>
      </div>

      <div style="background:#d1ecf1; border-left:4px solid #0c5460; padding:15px; margin:20px 0;">
        <p style="margin:0;"><strong>💡 Astuce</strong></p>
        <p style="margin:5px 0 0 0;">Gardez votre profil à jour pour améliorer votre visibilité sur FindLocate.</p>
      </div>

      <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin:20px 0;">
        <p style="margin:0;"><strong>⚠️ Ce n'était pas vous ?</strong></p>
        <p style="margin:5px 0 0 0;">Si vous n'avez pas effectué ces modifications, contactez-nous immédiatement.</p>
      </div>

      <div style="text-align:center; margin-top:25px;">
        <a href="${config.FRONTEND_URL}/user/${updatedFields.userId || ''}"
           style="background-color:#1877f2; color:white; padding:12px 30px; text-decoration:none; border-radius:6px;">
           Voir mon profil
        </a>
      </div>

      <p style="margin-top:30px; font-size:13px; color:#666; text-align:center;">
        © ${new Date().getFullYear()} FindLocate. All rights reserved.<br>
        Contact: dupontdjeague@gmail.com
      </p>
    </div>
  `

  await sendEmail(userEmail, subject, html)
  console.log('📩 Profile update email sent to:', userEmail)
}

// ✅ FONCTION INCHANGÉE - Envoi email de suppression de compte
const sendAccountDeletionEmail = async (userEmail, userName) => {
  const subject = '😢 Votre compte FindLocate a été supprimé'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#dc3545; text-align:center;">👋 Au revoir ${userName}</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Nous confirmons que votre compte FindLocate a été supprimé avec succès.</p>

      <div style="background:#f8d7da; border-left:4px solid #dc3545; padding:15px; margin:20px 0;">
        <p style="margin:0;"><strong>🗑️ Compte supprimé</strong></p>
        <p style="margin:5px 0 0 0;">Toutes vos données ont été définitivement supprimées de nos serveurs.</p>
      </div>

      <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0;">
        <h3 style="color:#333; margin-top:0;">📊 Qu'est-ce qui a été supprimé ?</h3>
        <ul style="margin:10px 0; padding-left:20px;">
          <li>Vos informations personnelles</li>
          <li>Toutes vos annonces publiées</li>
          <li>Vos messages et conversations</li>
          <li>Vos favoris et préférences</li>
        </ul>
      </div>

      <div style="background:#d1ecf1; border-left:4px solid #0c5460; padding:15px; margin:20px 0;">
        <p style="margin:0;"><strong>💙 Vous avez changé d'avis ?</strong></p>
        <p style="margin:5px 0 0 0;">Vous pouvez toujours créer un nouveau compte sur FindLocate à tout moment.</p>
      </div>

      <div style="text-align:center; margin-top:25px;">
        <a href="${config.FRONTEND_URL}/register"
           style="background-color:#1877f2; color:white; padding:12px 30px; text-decoration:none; border-radius:6px;">
           Créer un nouveau compte
        </a>
      </div>

      <p style="margin-top:30px;">Nous sommes tristes de vous voir partir. Si vous avez des commentaires ou suggestions, n'hésitez pas à nous contacter.</p>
      <p>Merci d'avoir utilisé FindLocate ! 💙</p>
      <p>— L'équipe FindLocate</p>

      <p style="margin-top:30px; font-size:13px; color:#666; text-align:center;">
        © ${new Date().getFullYear()} FindLocate. All rights reserved.<br>
        Contact: dupontdjeague@gmail.com
      </p>
    </div>
  `

  await sendEmail(userEmail, subject, html)
  console.log('📩 Account deletion email sent to:', userEmail)
}

// ✅ FONCTION INCHANGÉE - Envoi email de signalement d'annonce
const sendPostReportEmail = async (reportData) => {
  const {
    postId,
    postTitle,
    postType,
    postPrice,
    postLocation,
    postOwner,
    postOwnerId,
    reason,
    additionalInfo,
    reportedAt,
  } = reportData

  const subject = `🚨 Signalement d'annonce - ${postType}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .header {
          background-color: #dc3545;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background-color: white;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .alert-box {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
        }
        .info-box {
          background-color: #f0f8ff;
          border: 1px solid #ddd;
          padding: 15px;
          margin: 15px 0;
          border-radius: 5px;
        }
        .info-row {
          margin: 10px 0;
        }
        .label {
          font-weight: bold;
          color: #555;
        }
        .footer {
          text-align: center;
          color: #999;
          font-size: 12px;
          margin-top: 20px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #1877f2;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🚨 Signalement d'annonce</h1>
        </div>
        <div class="content">
          <p>Bonjour Administrateur,</p>
          
          <div class="alert-box">
            <strong>⚠️ Une annonce a été signalée de manière anonyme</strong>
          </div>

          <h3>📋 Informations de l'annonce signalée :</h3>
          <div class="info-box">
            <div class="info-row">
              <span class="label">ID de l'annonce :</span> ${postId}
            </div>
            <div class="info-row">
              <span class="label">Titre :</span> ${postTitle}
            </div>
            <div class="info-row">
              <span class="label">Type :</span> ${postType}
            </div>
            <div class="info-row">
              <span class="label">Prix :</span> ${parseInt(
                postPrice
              ).toLocaleString()} FCFA
            </div>
            <div class="info-row">
              <span class="label">Localisation :</span> ${postLocation}
            </div>
            <div class="info-row">
              <span class="label">Propriétaire :</span> ${postOwner} (ID: ${postOwnerId})
            </div>
          </div>

          <h3>🚩 Motif du signalement :</h3>
          <div class="info-box">
            <strong style="color: #dc3545;">${reason}</strong>
          </div>

          <h3>📝 Informations supplémentaires :</h3>
          <div class="info-box">
            <p style="margin: 0;">${additionalInfo}</p>
          </div>

          <div class="info-row">
            <span class="label">Date du signalement :</span> ${reportedAt}
          </div>

          <center>
            <a href="${
              config.FRONTEND_URL || 'http://localhost:5173'
            }/posts/${postId}" class="button">
              👁️ Voir l'annonce
            </a>
          </center>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            🔒 <strong>Note :</strong> Ce signalement est anonyme. L'utilisateur ayant signalé cette annonce reste confidentiel.
          </p>
        </div>
        <div class="footer">
          <p>Cet email a été envoyé automatiquement par le système de signalement.</p>
          <p>© ${new Date().getFullYear()} FindLocate - Tous droits réservés</p>
        </div>
      </div>
    </body>
    </html>
  `

  await sendEmail('findlocate237@gmail.com', subject, html)
}

// ✅ EXPORTS INCHANGÉS
module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPostCreatedEmail,
  sendWelcomeEmail,
  sendLoginSuccessEmail,
  sendPasswordResetSuccessEmail,
  sendProfileUpdateEmail,
  sendAccountDeletionEmail,
  testEmailConnection,
  sendPostReportEmail,
}
