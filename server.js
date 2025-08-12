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

// Webhook/endpoint para emitir y enviar diploma
app.post('/api/issue-cert', async (req, res) => {
  try {
    const { name, email } = req.body || {};

    // Validación básica
    const cleanName = (name || '').toString().trim();
    const cleanEmail = (email || '').toString().trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanName || cleanName.length < 3 || cleanName.length > 100) {
      return res.status(400).json({ ok: false, error: 'Nombre inválido' });
    }
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: 'Email inválido' });
    }

    // Generar PDF
    const pdfBuffer = await generateDiplomaBuffer({ name: cleanName });

    // Contenido del correo
    const subject = `${process.env.EVENT_SUBTITLE || 'Diploma'} - ${process.env.EVENT_TITLE || 'Evento'}`;
    const html = `
      <p>Hola <strong>${escapeHtml(cleanName)}</strong>,</p>
      <p>¡Gracias por participar en <strong>${escapeHtml(process.env.EVENT_TITLE || 'nuestro evento')}</strong>!</p>
      <p>Adjunto encontrarás tu <strong>diploma de participación</strong>.</p>
      <p>Saludos,<br>${escapeHtml(process.env.ORG_NAME || 'Organización')}</p>
    `;
    const text = `Hola ${cleanName},
Gracias por participar en ${process.env.EVENT_TITLE || 'nuestro evento'}.
Adjunto encontrarás tu diploma de participación.
Saludos, ${process.env.ORG_NAME || 'Organización'}`;

    await sendDiplomaEmail({
      to: cleanEmail,
      subject,
      html,
      text,
      pdfBuffer,
      filename: `Diploma - ${cleanName}.pdf`,
    });

    // Listo
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
