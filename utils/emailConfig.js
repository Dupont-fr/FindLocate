const sgMail = require('@sendgrid/mail')
const config = require('./config')

if (config.SENDGRID_API_KEY) {
  sgMail.setApiKey(config.SENDGRID_API_KEY)
  sgMail.setTimeout(80000)
  console.log('✅ SendGrid API key configured')
} else {
  console.warn(
    '⚠️ WARNING: SENDGRID_API_KEY not configured. Email features will not work.'
  )
}

const sendEmail = async (to, subject, html, retries = 3) => {
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

  // ✅ AMÉLIORATIONS ANTI-SPAM
  const msg = {
    to: to.trim(),
    from: {
      email: config.EMAIL_USER,
      name: 'FindLocate', // Nom cohérent et professionnel
    },
    subject: subject,
    html: html,

    // ✅ Ajout du texte brut (obligatoire pour éviter le spam)
    text: html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),

    // ✅ Catégories pour le suivi (aide à la réputation)
    categories: ['transactional', 'findlocate-notifications'],

    // ✅ Headers personnalisés pour authentification
    customArgs: {
      app: 'FindLocate',
      environment: process.env.NODE_ENV || 'production',
    },

    // ✅ Paramètres de tracking optimisés
    trackingSettings: {
      clickTracking: {
        enable: false, // Désactivé pour éviter les liens suspects
      },
      openTracking: {
        enable: false, // Désactivé pour éviter les pixels de tracking
      },
      subscriptionTracking: {
        enable: false, // Pas de lien de désinscription automatique
      },
    },

    // ✅ Configuration pour la délivrabilité
    mailSettings: {
      bypassListManagement: {
        enable: false, // Respecte les listes de suppression
      },
      footer: {
        enable: false, // Pas de footer automatique SendGrid
      },
      sandboxMode: {
        enable: false, // Mode production
      },
    },

    // ✅ Headers supplémentaires pour l'authentification
    headers: {
      'X-Entity-Ref-ID': `findlocate-${Date.now()}`,
      'List-Unsubscribe': `<mailto:dupontdjeague@gmail.com?subject=Unsubscribe>`,
    },

    // ✅ Type de contenu
    contentType: 'text/html',
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

      if (error.response) {
        console.error('📋 Error details:', {
          statusCode: error.code,
          body: error.response?.body,
        })
      }

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

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`⏳ Waiting ${delay}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

const testEmailConnection = async () => {
  try {
    if (!config.SENDGRID_API_KEY) {
      console.error('❌ SendGrid API key not configured')
      return false
    }

    console.log('✅ SendGrid configuration OK - Ready to send')
    return true
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error.message)
    return false
  }
}

// ✅ Template amélioré avec structure anti-spam
const getEmailTemplate = (content, headerColor, headerTitle) => {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headerTitle}</title>
    </head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color:#f4f4f4;">
      <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#f4f4f4; padding:20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" style="width:100%; max-width:600px; border-collapse:collapse; background-color:white; border-radius:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: ${headerColor}; color:white; padding:30px 20px; text-align:center; border-radius:12px 12px 0 0;">
                  <h1 style="margin:0; font-size:24px; font-weight:600;">${headerTitle}</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding:40px 30px;">
                  ${content}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color:#f9fafb; padding:30px; text-align:center; border-radius:0 0 12px 12px; border-top:1px solid #e5e7eb;">
                  <p style="margin:0 0 10px 0; font-size:14px; color:#6b7280;">
                    <strong>FindLocate</strong> - Votre plateforme immobilière de confiance
                  </p>
                  <p style="margin:0 0 15px 0; font-size:12px; color:#9ca3af;">
                    Cet email est envoyé depuis une adresse de notification.<br>
                    Pour toute question, contactez-nous à <a href="mailto:dupontdjeague@gmail.com" style="color:#1877f2; text-decoration:none;">dupontdjeague@gmail.com</a>
                  </p>
                  <p style="margin:0; font-size:11px; color:#9ca3af;">
                    © ${new Date().getFullYear()} FindLocate. Tous droits réservés.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

const sendVerificationEmail = async (email, code, firstName) => {
  const subject = 'Vérifiez votre compte FindLocate'

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour <strong>${firstName}</strong>,</p>
    <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Merci de vous être inscrit sur FindLocate. Pour activer votre compte, veuillez utiliser le code de vérification ci-dessous :
    </p>
    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <div style="background:#f0f9ff; border:2px solid #0ea5e9; padding:20px; border-radius:8px; display:inline-block;">
            <span style="font-size:36px; font-weight:bold; color:#0284c7; letter-spacing:8px; font-family:monospace;">${code}</span>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 10px 0; font-size:14px; color:#6b7280;">
      ⏰ Ce code expirera dans <strong>5 minutes</strong>
    </p>
    <p style="margin:10px 0 0 0; font-size:13px; color:#9ca3af; font-style:italic;">
      Si vous n'avez pas demandé cette vérification, vous pouvez ignorer cet email en toute sécurité.
    </p>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #0ea5e9, #0284c7)',
    '✅ Vérification de compte'
  )

  await sendEmail(email, subject, html)
  console.log('📩 Verification email sent to:', email)
}

const sendPasswordResetEmail = async (email, code, firstName) => {
  const subject = 'Réinitialisation de votre mot de passe FindLocate'

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour <strong>${firstName}</strong>,</p>
    <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte. Utilisez le code ci-dessous pour continuer :
    </p>
    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <div style="background:#fef2f2; border:2px solid #ef4444; padding:20px; border-radius:8px; display:inline-block;">
            <span style="font-size:36px; font-weight:bold; color:#dc2626; letter-spacing:8px; font-family:monospace;">${code}</span>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 10px 0; font-size:14px; color:#6b7280;">
      ⏰ Ce code expirera dans <strong>5 minutes</strong>
    </p>
    <p style="margin:10px 0 0 0; font-size:13px; color:#9ca3af; font-style:italic;">
      Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email et votre mot de passe restera inchangé.
    </p>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #ef4444, #dc2626)',
    '🔐 Réinitialisation de mot de passe'
  )

  await sendEmail(email, subject, html)
  console.log('📩 Password reset email sent to:', email)
}

const sendPostCreatedEmail = async (userEmail, postData) => {
  const { userName, postTitle, postType, location, price } = postData

  const subject = 'Votre annonce a été publiée sur FindLocate'

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Félicitations ! Votre annonce a été publiée avec succès sur FindLocate.
    </p>
    
    <div style="background:#f9fafb; border-left:4px solid #10b981; padding:20px; border-radius:6px; margin:25px 0;">
      <h3 style="margin:0 0 15px 0; color:#059669; font-size:16px;">📋 Détails de votre annonce</h3>
      <table role="presentation" style="width:100%; font-size:14px; color:#4b5563;">
        <tr>
          <td style="padding:5px 0;"><strong>Type :</strong></td>
          <td style="padding:5px 0;">${postType}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;"><strong>Description :</strong></td>
          <td style="padding:5px 0;">${postTitle}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;"><strong>Localisation :</strong></td>
          <td style="padding:5px 0;">${location}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;"><strong>Prix :</strong></td>
          <td style="padding:5px 0;">${price}</td>
        </tr>
      </table>
    </div>

    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <a href="https://findlocate-1.onrender.com" 
             style="display:inline-block; background-color:#1877f2; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;">
            Voir mon annonce
          </a>
        </td>
      </tr>
    </table>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #10b981, #059669)',
    '🎉 Annonce publiée'
  )

  await sendEmail(userEmail, subject, html)
  console.log('📩 Post created confirmation sent to:', userEmail)
}

const sendWelcomeEmail = async (userEmail, userName) => {
  const subject = 'Bienvenue sur FindLocate !'

  const content = `
    <p style="margin:0 0 20px 0; font-size:18px; color:#374151;">Bienvenue <strong>${userName}</strong> ! 🎉</p>
    <p style="margin:0 0 25px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Nous sommes ravis de vous accueillir sur FindLocate, votre plateforme de confiance pour l'immobilier.
    </p>
    
    <div style="background:#f0f9ff; border-radius:8px; padding:25px; margin:25px 0;">
      <h3 style="margin:0 0 15px 0; color:#0284c7; font-size:16px;">🚀 Commencez dès maintenant</h3>
      <ul style="margin:0; padding-left:20px; font-size:14px; color:#4b5563; line-height:2;">
        <li>Publiez vos annonces facilement</li>
        <li>Recherchez des logements</li>
        <li>Contactez directement les propriétaires</li>
        <li>Sauvegardez vos annonces préférées</li>
      </ul>
    </div>

    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <a href="https://findlocate-1.onrender.com" 
             style="display:inline-block; background-color:#1877f2; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;">
            Découvrir FindLocate
          </a>
        </td>
      </tr>
    </table>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #1877f2, #0c5bd8)',
    '👋 Bienvenue'
  )

  await sendEmail(userEmail, subject, html)
  console.log('📩 Welcome email sent to:', userEmail)
}

const sendLoginSuccessEmail = async (userEmail, userName, loginDetails) => {
  const { loginTime, ipAddress, device } = loginDetails

  const subject = 'Nouvelle connexion à votre compte FindLocate'

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Une nouvelle connexion a été détectée sur votre compte FindLocate.
    </p>

    <div style="background:#f0fdf4; border-left:4px solid #10b981; padding:20px; border-radius:6px; margin:25px 0;">
      <h3 style="margin:0 0 15px 0; color:#059669; font-size:16px;">📊 Détails de la connexion</h3>
      <table role="presentation" style="width:100%; font-size:14px; color:#4b5563;">
        <tr>
          <td style="padding:5px 0;"><strong>Date et heure :</strong></td>
          <td style="padding:5px 0;">${loginTime}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;"><strong>Adresse IP :</strong></td>
          <td style="padding:5px 0;">${ipAddress || 'Non disponible'}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;"><strong>Appareil :</strong></td>
          <td style="padding:5px 0;">${device || 'Non disponible'}</td>
        </tr>
      </table>
    </div>

    <div style="background:#fff7ed; border-left:4px solid #f59e0b; padding:15px; border-radius:6px; margin:20px 0;">
      <p style="margin:0; font-size:14px; color:#92400e;">
        <strong>⚠️ Ce n'était pas vous ?</strong><br>
        Si vous ne reconnaissez pas cette connexion, réinitialisez votre mot de passe immédiatement.
      </p>
    </div>

    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <a href="${config.FRONTEND_URL}/forgot-password" 
             style="display:inline-block; background-color:#dc3545; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;">
            Réinitialiser mon mot de passe
          </a>
        </td>
      </tr>
    </table>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #10b981, #059669)',
    '🔐 Nouvelle connexion'
  )

  await sendEmail(userEmail, subject, html)
  console.log('📩 Login success email sent to:', userEmail)
}

const sendPasswordResetSuccessEmail = async (userEmail, userName) => {
  const subject = 'Votre mot de passe a été modifié'

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
    </p>

    <div style="background:#f0fdf4; border-left:4px solid #10b981; padding:20px; border-radius:6px; margin:25px 0;">
      <p style="margin:0; font-size:14px; color:#065f46;">
        <strong>✅ Changement confirmé</strong><br>
        Votre compte est maintenant sécurisé avec votre nouveau mot de passe.
      </p>
    </div>

    <div style="background:#fff7ed; border-left:4px solid #f59e0b; padding:15px; border-radius:6px; margin:20px 0;">
      <p style="margin:0; font-size:14px; color:#92400e;">
        <strong>⚠️ Ce n'était pas vous ?</strong><br>
        Si vous n'avez pas effectué ce changement, contactez-nous immédiatement à dupontdjeague@gmail.com
      </p>
    </div>

    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <a href="${config.FRONTEND_URL}/login" 
             style="display:inline-block; background-color:#1877f2; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;">
            Se connecter
          </a>
        </td>
      </tr>
    </table>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #10b981, #059669)',
    '✅ Mot de passe modifié'
  )

  await sendEmail(userEmail, subject, html)
  console.log('📩 Password reset success email sent to:', userEmail)
}

const sendProfileUpdateEmail = async (userEmail, userName, updatedFields) => {
  const fieldsList = Object.keys(updatedFields)
    .filter((key) => key !== 'userId')
    .map((key) => {
      const displayNames = {
        firstName: 'Prénom',
        lastName: 'Nom',
        bio: 'Biographie',
        profilePicture: 'Photo de profil',
        password: 'Mot de passe',
      }
      return `<li style="padding:5px 0;">${displayNames[key] || key}</li>`
    })
    .join('')

  const subject = 'Votre profil FindLocate a été mis à jour'

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Les informations suivantes de votre profil ont été modifiées :
    </p>

    <div style="background:#f9fafb; border-left:4px solid #1877f2; padding:20px; border-radius:6px; margin:25px 0;">
      <h3 style="margin:0 0 15px 0; color:#1877f2; font-size:16px;">✏️ Modifications effectuées</h3>
      <ul style="margin:0; padding-left:20px; font-size:14px; color:#4b5563; line-height:1.8;">
        ${fieldsList}
      </ul>
    </div>

    <div style="background:#fff7ed; border-left:4px solid #f59e0b; padding:15px; border-radius:6px; margin:20px 0;">
      <p style="margin:0; font-size:14px; color:#92400e;">
        <strong>⚠️ Ce n'était pas vous ?</strong><br>
        Si vous n'avez pas effectué ces modifications, contactez-nous immédiatement.
      </p>
    </div>

    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <a href="${config.FRONTEND_URL}/user/${updatedFields.userId || ''}" 
             style="display:inline-block; background-color:#1877f2; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;">
            Voir mon profil
          </a>
        </td>
      </tr>
    </table>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #1877f2, #0c5bd8)',
    '📝 Profil mis à jour'
  )

  await sendEmail(userEmail, subject, html)
  console.log('📩 Profile update email sent to:', userEmail)
}

const sendAccountDeletionEmail = async (userEmail, userName) => {
  const subject = 'Votre compte FindLocate a été supprimé'

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:1.6;">
      Nous confirmons que votre compte FindLocate a été supprimé conformément à votre demande.
    </p>

    <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:20px; border-radius:6px; margin:25px 0;">
      <h3 style="margin:0 0 15px 0; color:#dc2626; font-size:16px;">🗑️ Données supprimées</h3>
      <ul style="margin:0; padding-left:20px; font-size:14px; color:#4b5563; line-height:1.8;">
        <li style="padding:5px 0;">Vos informations personnelles</li>
        <li style="padding:5px 0;">Toutes vos annonces publiées</li>
        <li style="padding:5px 0;">Vos messages et conversations</li>
        <li style="padding:5px 0;">Vos favoris et préférences</li>
      </ul>
    </div>

    <div style="background:#dbeafe; border-left:4px solid #3b82f6; padding:15px; border-radius:6px; margin:20px 0;">
      <p style="margin:0; font-size:14px; color:#1e40af;">
        <strong>💙 Vous avez changé d'avis ?</strong><br>
        Vous pouvez créer un nouveau compte à tout moment sur FindLocate.
      </p>
    </div>

    <p style="margin:30px 0 0 0; font-size:14px; color:#6b7280; line-height:1.6;">
      Merci d'avoir utilisé FindLocate. Si vous avez des suggestions pour améliorer notre service, n'hésitez pas à nous contacter à dupontdjeague@gmail.com
    </p>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #ef4444, #dc2626)',
    '👋 Au revoir'
  )

  await sendEmail(userEmail, subject, html)
  console.log('📩 Account deletion email sent to:', userEmail)
}

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

  const subject = `Signalement d'annonce - ${postType} - ${postId}`

  const content = `
    <p style="margin:0 0 20px 0; font-size:16px; color:#374151;">Bonjour Administrateur,</p>
    
    <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:20px; border-radius:6px; margin:25px 0;">
      <p style="margin:0; font-size:15px; color:#7f1d1d;">
        <strong>🚨 Une annonce a été signalée de manière anonyme</strong>
      </p>
    </div>

    <div style="background:#f9fafb; padding:20px; border-radius:6px; margin:25px 0;">
      <h3 style="margin:0 0 15px 0; color:#374151; font-size:16px;">📋 Informations de l'annonce</h3>
      <table role="presentation" style="width:100%; font-size:14px; color:#4b5563;">
        <tr>
          <td style="padding:8px 0; width:40%;"><strong>ID :</strong></td>
          <td style="padding:8px 0;">${postId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;"><strong>Titre :</strong></td>
          <td style="padding:8px 0;">${postTitle}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;"><strong>Type :</strong></td>
          <td style="padding:8px 0;">${postType}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;"><strong>Prix :</strong></td>
          <td style="padding:8px 0;">${parseInt(
            postPrice
          ).toLocaleString()} FCFA</td>
        </tr>
        <tr>
          <td style="padding:8px 0;"><strong>Localisation :</strong></td>
          <td style="padding:8px 0;">${postLocation}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;"><strong>Propriétaire :</strong></td>
          <td style="padding:8px 0;">${postOwner} (ID: ${postOwnerId})</td>
        </tr>
      </table>
    </div>

    <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:20px; border-radius:6px; margin:25px 0;">
      <h3 style="margin:0 0 10px 0; color:#92400e; font-size:16px;">🚩 Motif du signalement</h3>
      <p style="margin:0; font-size:14px; color:#78350f; font-weight:600;">${reason}</p>
    </div>

    <div style="background:#f9fafb; padding:20px; border-radius:6px; margin:25px 0;">
      <h3 style="margin:0 0 10px 0; color:#374151; font-size:16px;">📝 Informations supplémentaires</h3>
      <p style="margin:0; font-size:14px; color:#4b5563; line-height:1.6;">${additionalInfo}</p>
    </div>

    <p style="margin:20px 0; font-size:14px; color:#6b7280;">
      <strong>Date du signalement :</strong> ${reportedAt}
    </p>

    <table role="presentation" style="width:100%; margin:30px 0;">
      <tr>
        <td align="center">
          <a href="https://findlocate-1.onrender.com/posts/${postId}" 
             style="display:inline-block; background-color:#1877f2; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;">
            👁️ Voir l'annonce
          </a>
        </td>
      </tr>
    </table>

    <div style="background:#dbeafe; border-left:4px solid #3b82f6; padding:15px; border-radius:6px; margin:20px 0;">
      <p style="margin:0; font-size:13px; color:#1e40af;">
        <strong>🔒 Note :</strong> Ce signalement est anonyme. L'identité de l'utilisateur ayant signalé cette annonce reste confidentielle.
      </p>
    </div>
  `

  const html = getEmailTemplate(
    content,
    'linear-gradient(135deg, #ef4444, #dc2626)',
    "🚨 Signalement d'annonce"
  )

  await sendEmail('findlocate237@gmail.com', subject, html)
}

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
