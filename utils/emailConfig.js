const nodemailer = require('nodemailer')
const config = require('./config')

// === CONFIGURATION DU TRANSPORTEUR ===
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASS || config.EMAIL_PASSWORD, // compatibilité
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3',
  },
})

// Vérification initiale du transporteur
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email configuration error:', error.message)
  } else {
    console.log('✅ Email server is ready to send messages')
  }
})

const sendVerificationEmail = async (email, code, firstName) => {
  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: email,
    subject: '✅ Your FindLocate Verification Code',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Verification email sent to:', email)
}

const sendPasswordResetEmail = async (email, code, firstName) => {
  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Password Reset Code - FindLocate',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Password reset email sent to:', email)
}

const sendPostCreatedEmail = async (userEmail, postData) => {
  const { userName, postTitle, postType, location, price } = postData

  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: userEmail,
    subject: '🎉 Votre annonce a été publiée avec succès !',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Post created confirmation sent to:', userEmail)
}

const sendWelcomeEmail = async (userEmail, userName) => {
  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: userEmail,
    subject: '👋 Bienvenue sur FindLocate !',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Welcome email sent to:', userEmail)
}

const sendLoginSuccessEmail = async (userEmail, userName, loginDetails) => {
  const { loginTime, ipAddress, device } = loginDetails

  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: userEmail,
    subject: '✅ Connexion réussie à votre compte FindLocate',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Login success email sent to:', userEmail)
}

const sendPasswordResetSuccessEmail = async (userEmail, userName) => {
  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: userEmail,
    subject: '✅ Votre mot de passe a été réinitialisé avec succès',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Password reset success email sent to:', userEmail)
}

const sendProfileUpdateEmail = async (userEmail, userName, updatedFields) => {
  // 🆕 Créer une liste HTML des champs modifiés
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

  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: userEmail,
    subject: '✅ Votre profil a été mis à jour',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Profile update email sent to:', userEmail)
}

const sendAccountDeletionEmail = async (userEmail, userName) => {
  const mailOptions = {
    from: `FindLocate <${config.EMAIL_USER}>`,
    to: userEmail,
    subject: '😢 Votre compte FindLocate a été supprimé',
    html: `
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
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Account deletion email sent to:', userEmail)
}

const testEmailConnection = async () => {
  try {
    await transporter.verify()
    console.log('✅ Configuration email OK - Prêt à envoyer')
    return true
  } catch (error) {
    console.error('❌ Erreur configuration email:', error)
    return false
  }
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
}
