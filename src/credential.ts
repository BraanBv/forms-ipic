import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TEMPLATE = path.join(
  __dirname,
  '../assets/credencial.png'
);

// ======================================================
// CONFIGURACIÓN DEL NOMBRE
// ======================================================

const NAME_COLOR =
  process.env.NAME_COLOR ?? '#1b1b1b';

const NAME_BOX = {
  left: 130,
  right: 680,
  top: 850,
  bottom: 970,
};

const NAME_PADDING = 25;

// ======================================================
// CONFIGURACIÓN DE LA FOTO
// ======================================================
//
// Coordenadas para tu credencial de 1024 x 1536 px
//

const PHOTO_BOX = {
  left: 704,
  top: 802,
  width: 195,
  height: 235,
};

// Espacio entre la foto y el borde
const PHOTO_PADDING = 5;

// Radio de las esquinas del recuadro
const PHOTO_RADIUS = 14;

// Color del borde de la fotografía
const PHOTO_BORDER_COLOR = '#122E5C';

// Grosor del borde
const PHOTO_BORDER_WIDTH = 5;

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

const esc = (s: string) =>
  s.replace(/[<>&"']/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[c]!));


// ======================================================
// MEDIR TEXTO REAL
// ======================================================

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

  const { width } = await sharp(
    Buffer.from(svg)
  )
    .png()
    .metadata();

  return width ?? 0;
}


// ======================================================
// CALCULAR TAMAÑO DEL NOMBRE
// ======================================================

async function calculateFontSize(
  nombre: string,
  maxWidth: number
): Promise<number> {

  let fontSize = 52;

  const MIN_FONT_SIZE = 20;

  while (fontSize >= MIN_FONT_SIZE) {

    const textWidth =
      await measureText(
        nombre,
        fontSize
      );

    if (textWidth <= maxWidth) {
      return fontSize;
    }

    fontSize--;
  }

  return MIN_FONT_SIZE;
}


// ======================================================
// CREAR FOTO
// ======================================================

async function buildPhoto(
  fotoPath: string
): Promise<Buffer> {

  // Tamaño interior del marco
  const width =
    PHOTO_BOX.width -
    PHOTO_PADDING * 2;

  const height =
    PHOTO_BOX.height -
    PHOTO_PADDING * 2;

  // ----------------------------------------------------
  // REDIMENSIONAR FOTO
  // ----------------------------------------------------

  const img = await sharp(fotoPath)
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer();

  // ----------------------------------------------------
  // MÁSCARA CON ESQUINAS REDONDEADAS
  // ----------------------------------------------------

  const mask = Buffer.from(`
    <svg
      width="${width}"
      height="${height}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <rect
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        rx="${PHOTO_RADIUS}"
        ry="${PHOTO_RADIUS}"
        fill="white"
      />

    </svg>
  `);

  // Aplicar máscara
  return sharp(img)
    .composite([
      {
        input: mask,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
}


// ======================================================
// CREAR MARCO DE LA FOTO
// ======================================================

function buildPhotoFrame(
  width: number,
  height: number
): Buffer {

  const svg = `
    <svg
      width="${width}"
      height="${height}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <!-- Marco exterior -->
      <rect
        x="${PHOTO_BORDER_WIDTH / 2}"
        y="${PHOTO_BORDER_WIDTH / 2}"
        width="${width - PHOTO_BORDER_WIDTH}"
        height="${height - PHOTO_BORDER_WIDTH}"
        rx="${PHOTO_RADIUS}"
        ry="${PHOTO_RADIUS}"
        fill="none"
        stroke="${PHOTO_BORDER_COLOR}"
        stroke-width="${PHOTO_BORDER_WIDTH}"
      />

    </svg>
  `;

  return Buffer.from(svg);
}


// ======================================================
// GENERAR CREDENCIAL
// ======================================================

export async function generateCredential(
  nombre: string,
  fotoPath?: string
): Promise<Buffer> {

  // ----------------------------------------------------
  // CARGAR PLANTILLA
  // ----------------------------------------------------

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


  // ====================================================
  // NOMBRE
  // ====================================================

  const nombreLimpio =
    nombre
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();


  const boxWidth =
    NAME_BOX.right -
    NAME_BOX.left;


  const maxTextWidth =
    boxWidth -
    NAME_PADDING * 2;


  // Calcular tamaño real
  const fontSize =
    await calculateFontSize(
      nombreLimpio,
      maxTextWidth
    );


  // Centro horizontal
  const centerX =
    (NAME_BOX.left +
      NAME_BOX.right) / 2;


  // Centro vertical
  const centerY =
    (NAME_BOX.top +
      NAME_BOX.bottom) / 2;


  // Línea base
  const baselineY =
    centerY +
    fontSize * 0.35;


  // ====================================================
  // SVG DEL NOMBRE
  // ====================================================

  const nameSvg = `
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


  // ====================================================
  // CAPAS
  // ====================================================

  const capas = [];


  // ====================================================
  // FOTO
  // ====================================================

  if (
    fotoPath &&
    fs.existsSync(fotoPath)
  ) {

    // -----------------------------------------------
    // 1. Crear fotografía
    // -----------------------------------------------

    const photo =
      await buildPhoto(fotoPath);


    capas.push({
      input: photo,
      top:
        PHOTO_BOX.top +
        PHOTO_PADDING,
      left:
        PHOTO_BOX.left +
        PHOTO_PADDING,
    });


    // -----------------------------------------------
    // 2. Dibujar nuevamente el marco
    // -----------------------------------------------

    const frame =
      buildPhotoFrame(
        PHOTO_BOX.width,
        PHOTO_BOX.height
      );


    capas.push({
      input: frame,
      top: PHOTO_BOX.top,
      left: PHOTO_BOX.left,
    });
  }


  // ====================================================
  // NOMBRE
  // ====================================================

  capas.push({
    input: Buffer.from(nameSvg),
    top: 0,
    left: 0,
  });


  // ====================================================
  // GENERAR PNG
  // ====================================================

  return base
    .composite(capas)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
}