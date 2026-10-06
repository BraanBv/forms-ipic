import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TEMPLATE = path.join(__dirname, '../assets/credencial.png');

const NAME_COLOR = process.env.NAME_COLOR ?? '#1b1b1b';

// Área disponible para el nombre
const NAME_BOX = {
  left: 130,
  right: 680,
  top: 850,
  bottom: 970,
};

// Margen de seguridad dentro del recuadro
const NAME_PADDING = 25;

const esc = (s: string) =>
  s.replace(/[<>&"']/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[c]!));

/**
 * Mide el ancho real de un texto usando Sharp.
 */
async function measureText(
  text: string,
  fontSize: number
): Promise<number> {

  const svg = `
    <svg
      width="2000"
      height="200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="${fontSize}"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        font-size="${fontSize}px"
      >
        ${esc(text)}
      </text>
    </svg>
  `;

  const { width } = await sharp(Buffer.from(svg))
    .png()
    .metadata();

  return width ?? 0;
}

/**
 * Encuentra automáticamente el tamaño de fuente máximo
 * que permite que el nombre entre en el recuadro.
 */
async function calculateFontSize(
  nombre: string,
  maxWidth: number
): Promise<number> {

  // Tamaño inicial
  let fontSize = 52;

  // Tamaño mínimo permitido
  const MIN_FONT_SIZE = 20;

  while (fontSize > MIN_FONT_SIZE) {

    const textWidth = await measureText(
      nombre,
      fontSize
    );

    if (textWidth <= maxWidth) {
      return fontSize;
    }

    // Reducimos progresivamente
    fontSize -= 1;
  }

  return MIN_FONT_SIZE;
}

/**
 * Genera la credencial colocando el nombre
 * perfectamente dentro del área destinada.
 */
export async function generateCredential(
  nombre: string
): Promise<Buffer> {

  const base = fs.existsSync(TEMPLATE)
    ? sharp(TEMPLATE)
    : sharp({
        create: {
          width: 1024,
          height: 1536,
          channels: 4,
          background: '#ffffff',
        },
      });

  const {
    width = 1024,
    height = 1536,
  } = await base.clone().metadata();

  const nombreLimpio = nombre
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

  // ---------------------------------------
  // DIMENSIONES DEL CAMPO DEL NOMBRE
  // ---------------------------------------

  const boxWidth =
    NAME_BOX.right - NAME_BOX.left;

  const boxHeight =
    NAME_BOX.bottom - NAME_BOX.top;

  // Ancho realmente disponible
  const maxTextWidth =
    boxWidth - (NAME_PADDING * 2);

  // ---------------------------------------
  // CALCULAR FONT SIZE AUTOMÁTICAMENTE
  // ---------------------------------------

  const fontSize = await calculateFontSize(
    nombreLimpio,
    maxTextWidth
  );

  // ---------------------------------------
  // CENTRAR TEXTO
  // ---------------------------------------

  const centerX =
    (NAME_BOX.left + NAME_BOX.right) / 2;

  const centerY =
    (NAME_BOX.top + NAME_BOX.bottom) / 2;

  // Ajuste vertical para centrar visualmente
  const baselineY =
    centerY + (fontSize * 0.35);

  // ---------------------------------------
  // SVG DEL NOMBRE
  // ---------------------------------------

  const svg = `
    <svg
      width="${width}"
      height="${height}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <text
        x="${centerX}"
        y="${baselineY}"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        font-size="${fontSize}px"
        fill="${NAME_COLOR}"
      >
        ${esc(nombreLimpio)}
      </text>

    </svg>
  `;

  return base
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}