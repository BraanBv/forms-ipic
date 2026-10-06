import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// ======================================================
// PLANTILLA
// ======================================================

const TEMPLATE = path.join(
  __dirname,
  '../assets/credencial.png'
);


// ======================================================
// DIMENSIONES DE LA PLANTILLA
// ======================================================

const DESIGN_WIDTH = 1024;
const DESIGN_HEIGHT = 1536;


// ======================================================
// CONFIGURACIÓN DEL NOMBRE
// ======================================================

const NAME_COLOR =
  process.env.NAME_COLOR ?? '#1b1b1b';


// ======================================================
// ÁREA REAL DEL RECUADRO DEL NOMBRE
//
// Coordenadas basadas en la plantilla 1024 x 1536.
//
// El recuadro visible para el nombre está
// aproximadamente entre:
//
// X: 50 → 708
// Y: 745 → 865
// ======================================================

const NAME_BOX = {
  left: 50,
  right: 708,
  top: 745,
  bottom: 865,
};


// ======================================================
// MARGEN INTERNO DEL NOMBRE
// ======================================================

const NAME_PADDING = 20;


// ======================================================
// TAMAÑOS PERMITIDOS DE FUENTE
// ======================================================

const MAX_NAME_FONT_SIZE = 38;
const MIN_NAME_FONT_SIZE = 16;


// ======================================================
// CONFIGURACIÓN DE LA FOTO
//
// Estas coordenadas corresponden al interior del
// recuadro de fotografía de la plantilla.
//
// NO incluyen el borde azul.
//
// El borde original de la plantilla se conserva.
// ======================================================

const PHOTO_BOX = {
  left: 731,
  top: 695,
  width: 237,
  height: 260,
};


// ======================================================
// RADIO DE LAS ESQUINAS DE LA FOTO
// ======================================================

const PHOTO_RADIUS = 10;


// ======================================================
// ESCAPAR TEXTO PARA SVG
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
// CALCULAR ESCALA
// ======================================================

function getScale(
  width: number,
  height: number
) {
  return {
    x: width / DESIGN_WIDTH,
    y: height / DESIGN_HEIGHT,
  };
}


// ======================================================
// MEDIR TEXTO REAL
// ======================================================
//
// Esta función genera temporalmente el texto,
// lo recorta y obtiene su ancho real.
// ======================================================

async function measureText(
  text: string,
  fontSize: number
): Promise<number> {

  const svg = `
    <svg
      width="3000"
      height="300"
      xmlns="http://www.w3.org/2000/svg"
    >

      <text
        x="20"
        y="${fontSize + 20}"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        font-size="${fontSize}px"
        fill="#000000"
      >
        ${esc(text)}
      </text>

    </svg>
  `;

  const png = await sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();


  // Recortar todo el espacio transparente
  const trimmed = await sharp(png)
    .trim()
    .png()
    .toBuffer();


  const metadata =
    await sharp(trimmed)
      .metadata();


  return metadata.width ?? 0;
}


// ======================================================
// CALCULAR TAMAÑO DEL NOMBRE
// ======================================================
//
// Busca automáticamente el tamaño de fuente más grande
// que quepa dentro del recuadro.
// ======================================================

async function calculateFontSize(
  nombre: string,
  maxWidth: number
): Promise<number> {

  let low =
    MIN_NAME_FONT_SIZE;

  let high =
    MAX_NAME_FONT_SIZE;

  let best =
    MIN_NAME_FONT_SIZE;


  while (low <= high) {

    const middle =
      Math.floor(
        (low + high) / 2
      );


    const textWidth =
      await measureText(
        nombre,
        middle
      );


    if (textWidth <= maxWidth) {

      best = middle;

      low =
        middle + 1;

    } else {

      high =
        middle - 1;
    }
  }


  return best;
}


// ======================================================
// CREAR FOTO
// ======================================================
//
// La imagen se adapta al espacio utilizando "cover",
// evitando deformaciones.
// ======================================================

async function buildPhoto(
  fotoPath: string,
  width: number,
  height: number
): Promise<Buffer> {

  // ====================================================
  // REDIMENSIONAR FOTO
  // ====================================================

  const image =
    await sharp(fotoPath)
      .rotate()
      .resize({
        width,
        height,
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toBuffer();


  // ====================================================
  // MÁSCARA PARA ESQUINAS REDONDEADAS
  // ====================================================

  const mask =
    Buffer.from(`
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


  // ====================================================
  // APLICAR MÁSCARA
  // ====================================================

  return sharp(image)
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
// GENERAR CREDENCIAL
// ======================================================

export async function generateCredential(
  nombre: string,
  fotoPath?: string
) {


  // ====================================================
  // CARGAR PLANTILLA
  // ====================================================

  const base =
    fs.existsSync(TEMPLATE)

      ? sharp(TEMPLATE)

      : sharp({
          create: {
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            channels: 4,
            background: '#ffffff',
          },
        });


  // ====================================================
  // OBTENER DIMENSIONES REALES
  // ====================================================

  const metadata =
    await base.clone().metadata();


  const width =
    metadata.width ??
    DESIGN_WIDTH;


  const height =
    metadata.height ??
    DESIGN_HEIGHT;


  // ====================================================
  // CALCULAR ESCALA
  // ====================================================

  const scale =
    getScale(
      width,
      height
    );


  // ====================================================
  // LIMPIAR Y FORMATEAR NOMBRE
  // ====================================================

  const nombreLimpio =
    nombre
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();


  // ====================================================
  // ÁREA DEL NOMBRE
  // ====================================================

  const nameLeft =
    NAME_BOX.left * scale.x;

  const nameRight =
    NAME_BOX.right * scale.x;

  const nameTop =
    NAME_BOX.top * scale.y;

  const nameBottom =
    NAME_BOX.bottom * scale.y;


  // ====================================================
  // DIMENSIONES DEL ÁREA
  // ====================================================

  const nameWidth =
    nameRight - nameLeft;

  const nameHeight =
    nameBottom - nameTop;


  // ====================================================
  // ANCHO MÁXIMO DEL TEXTO
  // ====================================================

  const maxTextWidth =
    nameWidth -
    NAME_PADDING * 2;


  // ====================================================
  // CALCULAR TAMAÑO DE FUENTE
  // ====================================================

  const fontSizeBase =
    await calculateFontSize(
      nombreLimpio,
      maxTextWidth / scale.x
    );


  const fontSize =
    fontSizeBase * scale.x;


  // ====================================================
  // CENTRAR NOMBRE HORIZONTALMENTE
  // ====================================================

  const centerX =
    (nameLeft + nameRight) / 2;


  // ====================================================
  // CENTRAR NOMBRE VERTICALMENTE
  // ====================================================

  const centerY =
    (nameTop + nameBottom) / 2;


  // ====================================================
  // AJUSTE DE LÍNEA BASE
  // ====================================================

  const baselineY =
    centerY +
    fontSize * 0.35;


  // ====================================================
  // CREAR SVG DEL NOMBRE
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
        fill="${esc(NAME_COLOR)}"
      >
        ${esc(nombreLimpio)}
      </text>

    </svg>
  `;


  // ====================================================
  // CREAR CAPAS
  // ====================================================

  const layers = [];


  // ====================================================
  // FOTO
  // ====================================================

  if (
    fotoPath &&
    fs.existsSync(fotoPath)
  ) {

    // -----------------------------------------------
    // COORDENADAS ESCALADAS
    // -----------------------------------------------

    const photoLeft =
      Math.round(
        PHOTO_BOX.left * scale.x
      );


    const photoTop =
      Math.round(
        PHOTO_BOX.top * scale.y
      );


    const photoWidth =
      Math.round(
        PHOTO_BOX.width * scale.x
      );


    const photoHeight =
      Math.round(
        PHOTO_BOX.height * scale.y
      );


    // -----------------------------------------------
    // CREAR FOTOGRAFÍA
    // -----------------------------------------------

    const photo =
      await buildPhoto(
        fotoPath,
        photoWidth,
        photoHeight
      );


    // -----------------------------------------------
    // AGREGAR FOTO
    //
    // NO agregamos otro marco.
    //
    // El marco azul de la plantilla permanece visible.
    // -----------------------------------------------

    layers.push({

      input: photo,

      left: photoLeft,

      top: photoTop,

    });
  }


  // ====================================================
  // NOMBRE
  // ====================================================

  layers.push({

    input:
      Buffer.from(nameSvg),

    top: 0,

    left: 0,

  });


  // ====================================================
  // GENERAR CREDENCIAL FINAL
  // ====================================================

  return base
    .composite(layers)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
}