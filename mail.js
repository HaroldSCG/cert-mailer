// mail.js (modo prueba)
const fs = require('fs');
const path = require('path');

async function sendDiplomaEmail({ to, subject, html, text, pdfBuffer, filename = 'Diploma.pdf' }) {
  console.log(`📧 [SIMULADO] Enviando a: ${to}`);
  console.log(`Asunto: ${subject}`);
  console.log(`Texto: ${text}`);
  
  // Guardar en disco para verificar
  const outPath = path.join(__dirname, 'test-output.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`✅ PDF guardado en: ${outPath}`);

  return { id: 'test123', status: 'queued' };
}

module.exports = { sendDiplomaEmail };
