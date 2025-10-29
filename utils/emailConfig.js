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

/* -------------------------------------------------------------------------- */
/* 🟦 1️⃣ EMAIL DE VÉRIFICATION D’INSCRIPTION */
/* -------------------------------------------------------------------------- */
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
          <p>Thank you for registering! Here’s your verification code:</p>
          <div style="background:white; border:3px dashed #667eea; text-align:center; padding:15px; border-radius:10px;">
            <span style="font-size:32px; font-weight:bold; color:#667eea; letter-spacing:6px;">${code}</span>
          </div>
          <p style="margin-top:20px;">⏰ This code will expire in <strong>5 minutes</strong>.</p>
          <p>If you didn’t sign up, please ignore this email.</p>
          <p>— The FindLocate Team</p>
          <p>© ${new Date().getFullYear()} FindLocate. All rights reserved.</p> <p>You can contact dupontdjeague@gmail.com, for more informations about FindLocate.</p>
        </div>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Verification email sent to:', email)
}

/* -------------------------------------------------------------------------- */
/* 🟩 2️⃣ EMAIL DE RÉINITIALISATION DE MOT DE PASSE */
/* -------------------------------------------------------------------------- */
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
          <p>We received a request to reset your password. Here’s your code:</p>
          <div style="background:white; border:3px dashed #f5576c; text-align:center; padding:15px; border-radius:10px;">
            <span style="font-size:32px; font-weight:bold; color:#f5576c; letter-spacing:6px;">${code}</span>
          </div>
          <p style="margin-top:20px;">⏰ This code expires in <strong>5 minutes</strong>.</p>
          <p>If you didn’t request this, you can ignore this email.</p>
          <p>— The FindLocate Team</p>
        </div>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Password reset email sent to:', email)
}

/* -------------------------------------------------------------------------- */
/* 🟨 3️⃣ EMAIL DE CONFIRMATION DE PUBLICATION DE POST */
/* -------------------------------------------------------------------------- */
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
          <h3 style="color:#333;">📋 Détails de l’annonce :</h3>
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
          Si vous n’êtes pas à l’origine de cette action, contactez-nous immédiatement.
        </p>

        <p>© ${new Date().getFullYear()} FindLocate. All rights reserved.</p> <p>You can contact dupontdjeague@gmail.com, for more informations about FindLocate.</p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Post created confirmation sent to:', userEmail)
}

/* -------------------------------------------------------------------------- */
/* 🟧 4️⃣ EMAIL DE BIENVENUE */
/* -------------------------------------------------------------------------- */
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
          <li>💬 contacter directement les propietaires</li>
          <li>❤️ Sauvegardez vos annonces préférées</li>
          <li>Aidez nous a agrandir la communaute</li>
        </ul>

        <div style="text-align:center; margin-top:25px;">
          <a href="${config.FRONTEND_URL || 'http://localhost:5173'}"
             style="background-color:#1877f2; color:white; padding:12px 30px; text-decoration:none; border-radius:6px;">
             Commencer maintenant
          </a>

          <p>© ${new Date().getFullYear()} FindLocate. All rights reserved.</p> <p>You can contact dupontdjeague@gmail.com, for more informations about FindLocate.</p>
        </div>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('📩 Welcome email sent to:', userEmail)
}

/* -------------------------------------------------------------------------- */
/* 🟪 5️⃣ TEST DE CONFIGURATION SMTP */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* 🟫 EXPORTATION DES MÉTHODES */
/* -------------------------------------------------------------------------- */
module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPostCreatedEmail,
  sendWelcomeEmail,
  testEmailConnection,
}
