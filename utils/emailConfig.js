const SibApiV3Sdk = require('@sendinblue/client')
const config = require('./config')

let apiInstance = null

if (config.BREVO_API_KEY) {
  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
  const apiKey = apiInstance.authentications['apiKey']
  apiKey.apiKey = config.BREVO_API_KEY
  console.log('✅ Brevo API key configured')
} else {
  console.warn('⚠️  WARNING: BREVO_API_KEY not configured')
}

// 🔥 ENVOI EMAIL AVEC BREVO (Meilleure délivrabilité)
const sendEmail = async (to, subject, html, retries = 3) => {
  if (!config.BREVO_API_KEY) {
    throw new Error('Brevo API key not configured')
  }

  if (!to || !subject || !html) {
    throw new Error('Invalid email parameters')
  }

  // Email expéditeur (celui vérifié dans Brevo)
  const fromEmail = config.EMAIL_USER || 'findlocate237@gmail.com'

  // Texte brut automatique
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()

  sendSmtpEmail.sender = {
    name: 'FindLocate',
    email: fromEmail,
  }

  sendSmtpEmail.to = [{ email: to.trim().toLowerCase() }]
  sendSmtpEmail.subject = subject
  sendSmtpEmail.htmlContent = html
  sendSmtpEmail.textContent = plainText

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Envoi email à ${to} (tentative ${attempt}/${retries})`)

      const response = await apiInstance.sendTransacEmail(sendSmtpEmail)

      console.log(`✅ Email envoyé avec succès à ${to}`)
      console.log(`📧 Message ID: ${response.messageId}`)

      return {
        success: true,
        messageId: response.messageId,
      }
    } catch (error) {
      console.error(
        `❌ Erreur Brevo (tentative ${attempt}/${retries}):`,
        error.message
      )

      if (error.response) {
        console.error('Détails:', error.response.text || error.response.body)
      }

      if (attempt === retries) {
        throw new Error(`Échec envoi email: ${error.message}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

// 🔥 TEMPLATE SIMPLE ET EFFICACE
const getEmailTemplate = (content, title, headerColor = '#1877f2') => {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f6f9fc;">
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 20px;">
    <tr>
      <td align="center">
        
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${headerColor}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600;">
                ${title}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; border-radius: 0 0 10px 10px;">
              <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px; font-weight: 600;">
                FindLocate - Plateforme immobilière
              </p>
              <p style="margin: 0 0 15px 0; color: #adb5bd; font-size: 13px;">
                Douala, Cameroun
              </p>
              <p style="margin: 0 0 10px 0; color: #adb5bd; font-size: 12px;">
                Contact: <a href="mailto:findlocate237@gmail.com" style="color: #1877f2; text-decoration: none;">findlocate237@gmail.com</a>
              </p>
              <p style="margin: 0; color: #dee2e6; font-size: 11px;">
                © ${new Date().getFullYear()} FindLocate. Tous droits réservés.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Unsubscribe -->
        <p style="margin: 20px 0 0 0; text-align: center; color: #adb5bd; font-size: 11px;">
          <a href="mailto:findlocate237@gmail.com?subject=Unsubscribe" style="color: #adb5bd; text-decoration: underline;">Se désabonner</a>
        </p>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`
}

const testEmailConnection = async () => {
  if (!config.BREVO_API_KEY) {
    console.error('❌ Brevo API key not configured')
    return false
  }
  console.log('✅ Brevo configuration OK')
  return true
}

const sendVerificationEmail = async (email, code, firstName) => {
  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">Merci de vous être inscrit sur FindLocate. Voici votre code de vérification :</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <div style="background: #667eea; border-radius: 10px; padding: 20px; display: inline-block;">
        <span style="font-size: 36px; font-weight: bold; color: #ffffff; letter-spacing: 8px; font-family: monospace;">
          ${code}
        </span>
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px;">
      ⏰ Ce code expire dans <strong>5 minutes</strong>.
    </p>
    <p style="margin: 10px 0 0 0; color: #adb5bd; font-size: 13px; font-style: italic;">
      Si vous n'avez pas demandé cette vérification, ignorez cet email.
    </p>
  `

  await sendEmail(
    email,
    'Vérification de compte - FindLocate',
    getEmailTemplate(content, '✅ Vérification de compte', '#667eea')
  )
  console.log('📩 Verification email sent')
}

const sendPasswordResetEmail = async (email, code, firstName) => {
  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">Vous avez demandé une réinitialisation de mot de passe. Voici votre code :</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <div style="background: #dc3545; border-radius: 10px; padding: 20px; display: inline-block;">
        <span style="font-size: 36px; font-weight: bold; color: #ffffff; letter-spacing: 8px; font-family: monospace;">
          ${code}
        </span>
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px;">
      ⏰ Ce code expire dans <strong>5 minutes</strong>.
    </p>
    <p style="margin: 10px 0 0 0; color: #adb5bd; font-size: 13px; font-style: italic;">
      Si vous n'avez pas demandé cela, ignorez cet email.
    </p>
  `

  await sendEmail(
    email,
    'Réinitialisation de mot de passe - FindLocate',
    getEmailTemplate(content, '🔐 Réinitialisation', '#dc3545')
  )
  console.log('📩 Password reset email sent')
}

const sendWelcomeEmail = async (userEmail, userName) => {
  const content = `
    <p style="margin: 0 0 20px 0; font-size: 18px;">Bienvenue <strong>${userName}</strong> ! 🎉</p>
    <p style="margin: 0 0 25px 0;">Nous sommes ravis de vous accueillir sur FindLocate.</p>
    
    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #1877f2;">🚀 Commencez maintenant</h3>
      <ul style="margin: 0; padding-left: 20px; line-height: 2;">
        <li>Publiez vos annonces</li>
        <li>Recherchez des logements</li>
        <li>Contactez des propriétaires</li>
        <li>Sauvegardez vos favoris</li>
      </ul>
    </div>

    <p style="text-align: center; margin: 30px 0;">
      <a href="https://findlocate-1.onrender.com" style="background: #1877f2; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Découvrir FindLocate
      </a>
    </p>
  `

  await sendEmail(
    userEmail,
    'Bienvenue sur FindLocate',
    getEmailTemplate(content, '👋 Bienvenue')
  )
  console.log('📩 Welcome email sent')
}

const sendPostCreatedEmail = async (userEmail, postData) => {
  const { userName, postTitle, postType, location, price } = postData

  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">Votre annonce a été publiée avec succès ! 🎉</p>
    
    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 6px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #059669;">📋 Détails</h3>
      <p style="margin: 5px 0;"><strong>Type :</strong> ${postType}</p>
      <p style="margin: 5px 0;"><strong>Description :</strong> ${postTitle}</p>
      <p style="margin: 5px 0;"><strong>Localisation :</strong> ${location}</p>
      <p style="margin: 5px 0;"><strong>Prix :</strong> ${price}</p>
    </div>

    <p style="text-align: center; margin: 30px 0;">
      <a href="https://findlocate-1.onrender.com" style="background: #10b981; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Voir mon annonce
      </a>
    </p>
  `

  await sendEmail(
    userEmail,
    'Annonce publiée - FindLocate',
    getEmailTemplate(content, '🎉 Annonce publiée', '#10b981')
  )
  console.log('📩 Post created email sent')
}

const sendLoginSuccessEmail = async (userEmail, userName, loginDetails) => {
  const { loginTime, ipAddress, device } = loginDetails

  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">Nouvelle connexion détectée sur votre compte.</p>

    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 6px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #059669;">📊 Détails</h3>
      <p style="margin: 5px 0;"><strong>Date :</strong> ${loginTime}</p>
      <p style="margin: 5px 0;"><strong>IP :</strong> ${
        ipAddress || 'Non disponible'
      }</p>
      <p style="margin: 5px 0;"><strong>Appareil :</strong> ${
        device || 'Non disponible'
      }</p>
    </div>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">
        <strong>⚠️ Ce n'était pas vous ?</strong><br>
        Réinitialisez votre mot de passe immédiatement.
      </p>
    </div>
  `

  await sendEmail(
    userEmail,
    'Nouvelle connexion - FindLocate',
    getEmailTemplate(content, '🔐 Nouvelle connexion', '#10b981')
  )
  console.log('📩 Login success email sent')
}

const sendPasswordResetSuccessEmail = async (userEmail, userName) => {
  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">Votre mot de passe a été réinitialisé avec succès.</p>

    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 6px; margin: 25px 0;">
      <p style="margin: 0;">
        <strong>✅ Changement confirmé</strong><br>
        Votre compte est sécurisé.
      </p>
    </div>

    <p style="text-align: center; margin: 30px 0;">
      <a href="https://findlocate-1.onrender.com/login" style="background: #1877f2; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Se connecter
      </a>
    </p>
  `

  await sendEmail(
    userEmail,
    'Mot de passe modifié - FindLocate',
    getEmailTemplate(content, '✅ Mot de passe modifié', '#10b981')
  )
  console.log('📩 Password reset success email sent')
}

const sendProfileUpdateEmail = async (userEmail, userName, updatedFields) => {
  const fields = Object.keys(updatedFields)
    .filter((key) => key !== 'userId')
    .map((key) => {
      const names = {
        firstName: 'Prénom',
        lastName: 'Nom',
        bio: 'Biographie',
        profilePicture: 'Photo de profil',
        password: 'Mot de passe',
      }
      return `<li>${names[key] || key}</li>`
    })
    .join('')

  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">Votre profil a été mis à jour.</p>

    <div style="background: #eff6ff; border-left: 4px solid #1877f2; padding: 20px; border-radius: 6px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #1877f2;">✏️ Modifications</h3>
      <ul style="margin: 0; padding-left: 20px;">${fields}</ul>
    </div>

    <p style="text-align: center; margin: 30px 0;">
      <a href="https://findlocate-1.onrender.com/user/${
        updatedFields.userId || ''
      }" style="background: #1877f2; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Voir mon profil
      </a>
    </p>
  `

  await sendEmail(
    userEmail,
    'Profil mis à jour - FindLocate',
    getEmailTemplate(content, '📝 Profil mis à jour')
  )
  console.log('📩 Profile update email sent')
}

const sendAccountDeletionEmail = async (userEmail, userName) => {
  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">Votre compte FindLocate a été supprimé.</p>

    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 6px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #dc2626;">🗑️ Données supprimées</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Informations personnelles</li>
        <li>Annonces</li>
        <li>Messages</li>
        <li>Favoris</li>
      </ul>
    </div>

    <p style="margin: 30px 0 0 0;">Merci d'avoir utilisé FindLocate.</p>
  `

  await sendEmail(
    userEmail,
    'Compte supprimé - FindLocate',
    getEmailTemplate(content, '👋 Au revoir', '#ef4444')
  )
  console.log('📩 Account deletion email sent')
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

  const content = `
    <p style="margin: 0 0 20px 0;">Bonjour Administrateur,</p>
    
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 6px; margin: 25px 0;">
      <p style="margin: 0; font-weight: 600;">🚨 Signalement d'annonce</p>
    </div>

    <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0;">📋 Informations</h3>
      <p style="margin: 5px 0;"><strong>ID :</strong> ${postId}</p>
      <p style="margin: 5px 0;"><strong>Titre :</strong> ${postTitle}</p>
      <p style="margin: 5px 0;"><strong>Type :</strong> ${postType}</p>
      <p style="margin: 5px 0;"><strong>Prix :</strong> ${parseInt(
        postPrice
      ).toLocaleString()} FCFA</p>
      <p style="margin: 5px 0;"><strong>Localisation :</strong> ${postLocation}</p>
      <p style="margin: 5px 0;"><strong>Propriétaire :</strong> ${postOwner} (${postOwnerId})</p>
    </div>

    <p style="margin: 20px 0;"><strong>Motif :</strong> ${reason}</p>
    <p style="margin: 20px 0;"><strong>Détails :</strong> ${additionalInfo}</p>
    <p style="margin: 20px 0;"><strong>Date :</strong> ${reportedAt}</p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="https://findlocate-1.onrender.com/posts/${postId}" style="background: #1877f2; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Voir l'annonce
      </a>
    </p>
  `

  await sendEmail(
    'findlocate237@gmail.com',
    `Signalement - ${postType} - ${postId}`,
    getEmailTemplate(content, '🚨 Signalement', '#ef4444')
  )
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
