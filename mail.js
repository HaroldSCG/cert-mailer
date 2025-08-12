// mail.js
require('dotenv').config();
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mg = new Mailgun(formData);

const client = mg.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

async function sendDiplomaEmail({ to, subject, html, text, pdfBuffer, filename = 'Diploma.pdf' }) {
  try {
    const messageData = {
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      html,
      attachment: [
        {
          filename,
          data: pdfBuffer
        }
      ]
    };

    const result = await client.messages.create(process.env.MAILGUN_DOMAIN, messageData);
    console.log(`✅ Correo enviado a ${to} (ID: ${result.id})`);
    return result;
  } catch (error) {
    console.error(`❌ Error enviando correo a ${to}:`, error);
    throw error;
  }
}

module.exports = { sendDiplomaEmail };
