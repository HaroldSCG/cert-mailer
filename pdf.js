// pdf.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function mm(n) {
  // PDFKit trabaja en puntos (72 dpi). 1 mm ≈ 2.83465 pt
  return n * 2.83465;
}

function mmToPx(mmValue, totalMm, totalPx) {
  // Convierte milímetros a píxeles según el tamaño real del PNG
  return (mmValue / totalMm) * totalPx;
}

function generateDiplomaBuffer({ name }) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1) Cargamos el fondo
      const bgPath = path.join(__dirname, 'assets', 'cert.png');

      let flattenedPng;

      if (fs.existsSync(bgPath)) {
        const bg = sharp(bgPath);
        const meta = await bg.metadata();
        const widthPx = meta.width || 2794;   // fallback ~300 dpi
        const heightPx = meta.height || 2159; // fallback ~300 dpi

        // Dimensiones físicas del diseño (Carta apaisado)
        const PAGE_W_MM = 279.4;
        const PAGE_H_MM = 215.9;

        // === Posicionamiento y formato (igual a tu lógica anterior) ===
        const topYmm = 20;                    // topY = mm(20)
        const nameOffsetYmm = 70;             // + mm(70)
        const nameYmm = topYmm + nameOffsetYmm; // 90 mm desde arriba

        const sideMarginMm = 30;              // margen lateral: 30 mm
        const maxTextWidthMm = PAGE_W_MM - sideMarginMm; // 279.4 - 30 = 249.4 mm

        // Convertimos a píxeles para el PNG real
        const yPx = Math.round(mmToPx(nameYmm, PAGE_H_MM, heightPx));
        const maxTextWidthPx = Math.round(mmToPx(maxTextWidthMm, PAGE_W_MM, widthPx));

        // Tamaño base de letra (alto para buena presencia visual)
        // Como el ancho lo forzaremos con textLength, no necesitamos iterar tamaños.
        const fontPx = 100;

        // SVG overlay para "pintar" el nombre dentro del PNG (aplanado)
        const svg = `
          <svg width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" xmlns="http://www.w3.org/2000/svg">
            <style>
              text { font-family: "Times New Roman", Times, serif; }
            </style>
            <text
              x="${Math.round(widthPx / 2)}"
              y="${yPx}"
              font-size="${fontPx}"
              fill="#131a6dff"
              text-anchor="middle"
              dominant-baseline="middle"
              textLength="${maxTextWidthPx}"
              lengthAdjust="spacingAndGlyphs"
            >${escapeXml(name)}</text>
          </svg>`;

        flattenedPng = await bg
          .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
          .png()
          .toBuffer();
      } else {
        // Si no está el PNG, generamos lienzo blanco (para no fallar)
        const width = 2794, height = 2159;
        flattenedPng = await sharp({
          create: { width, height, channels: 3, background: '#ffffff' }
        }).png().toBuffer();
      }

      // 2) Insertamos la imagen a toda página en el PDF (queda una sola capa)
      const doc = new PDFDocument({
        size: [mm(279.4), mm(215.9)], // Carta apaisado
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.image(flattenedPng, 0, 0, { width: doc.page.width, height: doc.page.height });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Utilitario para texto en SVG
function escapeXml(s) {
  return s.replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

module.exports = { generateDiplomaBuffer };
