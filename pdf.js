// pdf.js
'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

// ==== Utilidades de medidas ====
function mm(n) { return n * 2.83465; } // 1 mm ≈ 2.83465 pt
function mmToPx(mmValue, totalMm, totalPx) {
  return (mmValue / totalMm) * totalPx;
}

// ==== Página (Carta apaisado) ====
const PAGE_W_MM = 279.4;
const PAGE_H_MM = 215.9;

// ==== Layout del nombre (ajusta a tu diseño) ====
const TOP_Y_MM = 20;           // margen superior
const NAME_OFFSET_Y_MM = 70;   // desplazamiento desde TOP
const NAME_Y_MM = TOP_Y_MM + NAME_OFFSET_Y_MM;

const SIDE_MARGIN_TOTAL_MM = 30; // 30 mm total (≈15 mm por lado)
const MAX_TEXT_WIDTH_MM = PAGE_W_MM - SIDE_MARGIN_TOTAL_MM;

// ==== Fuente embebida ====
const FONT_PATH = path.join(__dirname, 'assets', 'fonts', 'NotoSerif-Regular.ttf');
const FALLBACK_FONT_FAMILY = 'serif'; // solo por si falta el TTF (no recomendado)

// Tamaño base de la letra en píxeles (para el SVG)
const BASE_FONT_PX = 100;

// Heurística simple para escalar tamaño de letra según longitud del nombre
function autosizeFontPx(name) {
  const len = (name || '').length;
  if (len <= 26) return BASE_FONT_PX;
  if (len <= 36) return Math.round(BASE_FONT_PX * 0.9);
  if (len <= 46) return Math.round(BASE_FONT_PX * 0.8);
  if (len <= 60) return Math.round(BASE_FONT_PX * 0.72);
  return Math.round(BASE_FONT_PX * 0.65);
}

// Escapar caracteres especiales XML para el contenido del <text>
function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

// Renderiza la capa de texto (SVG) a PNG usando Resvg (soporta @font-face data:)
// widthPx/heightPx: tamaño del PNG fondo
async function renderTextLayerPng({ widthPx, heightPx, yPx, name, fontPx }) {
  let fontBase64 = null;
  if (fs.existsSync(FONT_PATH)) {
    fontBase64 = fs.readFileSync(FONT_PATH).toString('base64');
  } else {
    console.warn('[pdf.js] No se encontró la fuente TTF en', FONT_PATH, '— se usará fallback del sistema (puede fallar con tildes).');
  }

  const svg = `
  <svg width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" xmlns="http://www.w3.org/2000/svg">
    <style>
      ${fontBase64 ? `
      @font-face {
        font-family: 'DiplomaFont';
        src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
        font-weight: normal; font-style: normal;
      }` : ''}
      text { font-family: ${fontBase64 ? "'DiplomaFont'" : FALLBACK_FONT_FAMILY}; }
    </style>
    <text x="${Math.round(widthPx/2)}" y="${yPx}"
          font-size="${fontPx}" fill="#131a6d"
          text-anchor="middle" dominant-baseline="middle">
      ${escapeXml(name)}
    </text>
  </svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
  const pngData = resvg.render().asPng(); // Buffer PNG
  return pngData;
}

function generateDiplomaBuffer({ name }) {
  return new Promise(async (resolve, reject) => {
    try {
      // Normaliza a NFC para acentos compuestos (muy importante)
      name = (name || '').toString().trim().normalize('NFC');
      if (!name) throw new Error('El nombre es obligatorio');

      // 1) Cargar fondo
      const bgPath = path.join(__dirname, 'assets', 'cert.png');
      if (!fs.existsSync(bgPath)) {
        throw new Error('No se encontró assets/cert.png');
      }

      const bg = sharp(bgPath);
      const meta = await bg.metadata();
      const widthPx = meta.width || 2794;   // fallback aprox ~300 dpi
      const heightPx = meta.height || 2159; // fallback aprox ~300 dpi

      // Posicionamiento del texto en píxeles
      const yPx = Math.round(mmToPx(NAME_Y_MM, PAGE_H_MM, heightPx));
      const fontPx = autosizeFontPx(name);

      // 2) Capa de texto renderizada con Resvg
      const textLayerPng = await renderTextLayerPng({ widthPx, heightPx, yPx, name, fontPx });

      // 3) Componer texto sobre el fondo con Sharp
      const flattenedPng = await bg
        .composite([{ input: textLayerPng, top: 0, left: 0 }])
        .png()
        .toBuffer();

      // 4) Montar PDF con PDFKit usando la imagen a página completa
      const doc = new PDFDocument({
        size: [mm(PAGE_W_MM), mm(PAGE_H_MM)],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.image(flattenedPng, 0, 0, { width: doc.page.width, height: doc.page.height });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateDiplomaBuffer };
