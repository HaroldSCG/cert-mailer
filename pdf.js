// pdf.js
'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ==== Utilidades de medidas ====
function mm(n) { return n * 2.83465; } // 1 mm ≈ 2.83465 pt

// ==== Página (Carta apaisado) ====
const PAGE_W_MM = 279.4;
const PAGE_H_MM = 215.9;

// ==== Layout del nombre (ajusta a tu diseño) ====
const TOP_Y_MM = 20;           // margen superior
const NAME_OFFSET_Y_MM = 70;   // desplazamiento desde TOP
const NAME_Y_MM = TOP_Y_MM + NAME_OFFSET_Y_MM;

const SIDE_MARGIN_TOTAL_MM = 30; // 30 mm total (≈15 mm por lado)
const MAX_TEXT_WIDTH_MM = PAGE_W_MM - SIDE_MARGIN_TOTAL_MM;
const LEFT_MARGIN_MM = (PAGE_W_MM - MAX_TEXT_WIDTH_MM) / 2;

// ==== Fuente TTF para PDFKit (unicode) ====
const FONT_PATH = path.join(__dirname, 'assets', 'fonts', 'NotoSerif-Regular.ttf');
// Puedes usar DejaVuSerif.ttf o NotoSans-Regular.ttf si prefieres sans

// Tuning de fuente para auto-ajuste en el ancho permitido
const DEFAULT_FONT_PT = 72;
const MIN_FONT_PT = 32;

function generateDiplomaBuffer({ name }) {
  return new Promise(async (resolve, reject) => {
    try {
      // Normaliza a NFC para evitar issues de acentos combinados
      name = (name || '').toString().trim().normalize('NFC');
      if (!name) throw new Error('El nombre es obligatorio');

      // 1) Prepara el fondo con Sharp (por si quieres mantener el pipeline)
      const bgPath = path.join(__dirname, 'assets', 'cert.png');
      let bgBuffer;

      if (fs.existsSync(bgPath)) {
        // Aseguramos PNG buffer válido
        bgBuffer = await sharp(bgPath).png().toBuffer();
      } else {
        // Si no está el PNG, crea lienzo blanco
        const width = 2794, height = 2159; // aprox 300 dpi carta apaisado
        bgBuffer = await sharp({
          create: { width, height, channels: 3, background: '#ffffff' }
        }).png().toBuffer();
      }

      // 2) Crea el PDF y coloca el fondo a página completa
      const doc = new PDFDocument({
        size: [mm(PAGE_W_MM), mm(PAGE_H_MM)],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Fondo
      doc.image(bgBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

      // 3) Registrar fuente con soporte unicode y escribir el nombre
      let fontName = 'Helvetica';
      if (fs.existsSync(FONT_PATH)) {
        doc.registerFont('DiplomaFont', FONT_PATH);
        fontName = 'DiplomaFont';
      } else {
        // Seguirá funcionando, pero algunos visores podrían no dibujar bien acentos
        console.warn('[pdf.js] No se encontró la fuente TTF en', FONT_PATH, '— usando Helvetica (no recomendado para tildes).');
      }

      const maxWidthPt = mm(MAX_TEXT_WIDTH_MM);
      const leftPt = mm(LEFT_MARGIN_MM);
      const topPt  = mm(NAME_Y_MM);

      // Auto-ajuste de tamaño para que quepa en el ancho
      let fontSize = DEFAULT_FONT_PT;
      doc.font(fontName).fontSize(fontSize);
      let textWidth = doc.widthOfString(name);

      while (textWidth > maxWidthPt && fontSize > MIN_FONT_PT) {
        fontSize -= 2;
        doc.fontSize(fontSize);
        textWidth = doc.widthOfString(name);
      }

      // Color (sin alfa) y texto centrado en el ancho disponible
      doc
        .fillColor('#131a6d')
        .text(name, leftPt, topPt, { width: maxWidthPt, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateDiplomaBuffer };
