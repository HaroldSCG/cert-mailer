// server.js
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const { generateDiplomaBuffer } = require('./pdf');
const { sendDiplomaEmail } = require('./mail');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

const PORT = process.env.PORT || 8080;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

function verifySecret(req, res, next) {
  if (!WEBHOOK_SECRET) return next();
  const incoming = req.header('X-Webhook-Secret') || '';
  if (incoming !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'cert-mailer', time: new Date().toISOString() });
});

// Vista previa en navegador
app.get('/api/preview', async (req, res) => {
  try {
    const name = (req.query.name || '').toString().trim();
    if (!name) return res.status(400).send('Falta ?name=');

    const buffer = await generateDiplomaBuffer({ name });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Diploma-${encodeURIComponent(name)}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando PDF');
  }
});

// Emite y envía diploma (protege con secret si está configurado)
app.post('/api/issue-cert', async (req, res) => {
  try {
    // Validar secreto del webhook
    const incomingSecret = req.headers['x-webhook-secret'] || req.query.secret;
    if (incomingSecret !== process.env.WEBHOOK_SECRET) {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }

    const { name, email } = req.body || {};

    const cleanName = (name || '').toString().trim();
    const cleanEmail = (email || '').toString().trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanName || cleanName.length < 3 || cleanName.length > 100) {
      return res.status(400).json({ ok: false, error: 'Nombre inválido' });
    }
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: 'Email inválido' });
    }

    const pdfBuffer = await generateDiplomaBuffer({ name: cleanName });

    const subject = 'Diploma de participación';
    const html = `
      <p>Hola <strong>${escapeHtml(cleanName)}</strong>,</p>
      <p>Adjunto encontrarás tu <strong>diploma de participación</strong>.</p>
      <p>Saludos.</p>
    `;
    const text = `Hola ${cleanName},
Adjunto encontrarás tu diploma de participación.
Saludos.`;

    await sendDiplomaEmail({
      to: cleanEmail,
      subject,
      html,
      text,
      pdfBuffer,
      filename: `Diploma - ${cleanName}.pdf`
    });

    res.status(202).json({ ok: true, message: 'Enviado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error enviando el diploma' });
  }
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

app.listen(PORT, () => {
  console.log(`cert-mailer escuchando en :${PORT}`);
});
