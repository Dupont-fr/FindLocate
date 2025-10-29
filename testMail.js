const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'findlocate237@gmail.com',
    pass: 'mqvpmfhfsglaaflv', // mot de passe d'application sans espaces
  },
  tls: { rejectUnauthorized: false },
})

transporter
  .verify()
  .then(() => console.log('✅ Connexion SMTP réussie !'))
  .catch((e) => console.error('❌ Erreur SMTP :', e))
