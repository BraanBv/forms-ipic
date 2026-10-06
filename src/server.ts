import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { generateCredential } from './credential';

const app = express();
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const DB = path.join(__dirname, '../data/registros.json');
const FOTOS = path.join(__dirname, '../data/fotos');
fs.mkdirSync(FOTOS, { recursive: true });
// Borra cualquier foto que haya quedado en disco de ejecuciones anteriores
fs.readdirSync(FOTOS).forEach(f => fs.rmSync(path.join(FOTOS, f), { force: true }));
const AVISO_VERSION = '2026-10-06';
const fotoPath = (id: string) => path.join(FOTOS, `${id}.jpg`);
const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'cambiar123';
const NIVELES = ['Sin estudios', 'Primaria', 'Secundaria', 'Preparatoria / Bachillerato',
  'Carrera técnica / TSU (Técnico Superior Universitario)', 'Universidad (Licenciatura)',
  'Especialidad', 'Maestría', 'Doctorado'];
const GENEROS = ['Femenino', 'Masculino', 'Otro', 'Prefiero no decir'];

interface Registro { id: string; nombre: string; genero: string; correo: string; telefono: string;
  nivel: string; escuela: string; carrera: string; fecha: string;
  consentimiento: { version: string; fecha: string }; }

const leer = (): Registro[] => fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : [];
const guardar = (r: Registro[]) => fs.writeFileSync(DB, JSON.stringify(r, null, 2));

app.post('/api/registro', async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const nombre = String(b.nombre ?? '').trim();
  const correo = String(b.correo ?? '').trim().toLowerCase();
  const telefono = String(b.telefono ?? '').replace(/\D/g, '');
  const nivelIdx = NIVELES.indexOf(b.nivel);
  const carrera = String(b.carrera ?? '').trim().slice(0, 120);
  const escuela = String(b.escuela ?? '').trim().slice(0, 120);
  if (nombre.length < 5) return res.status(400).json({ error: 'Escribe tu nombre completo.' });
  if (!GENEROS.includes(b.genero)) return res.status(400).json({ error: 'Selecciona un género.' });
  if (!/^\S+@\S+\.\S+$/.test(correo)) return res.status(400).json({ error: 'Correo inválido.' });
  if (telefono.length !== 10) return res.status(400).json({ error: 'El celular debe tener 10 dígitos.' });
  if (nivelIdx < 0) return res.status(400).json({ error: 'Selecciona tu formación profesional.' });
  if (nivelIdx >= 1 && escuela.length < 3) return res.status(400).json({ error: 'Indica tu escuela de procedencia.' });
  if (nivelIdx >= 4 && !carrera) return res.status(400).json({ error: 'Indica tu carrera / especialidad.' });
  const foto = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(b.foto ?? ''));
  if (!foto) return res.status(400).json({ error: 'Agrega tu foto de perfil.' });
  const fotoBuf = Buffer.from(foto[2], 'base64');
  if (fotoBuf.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'La foto pesa más de 4 MB.' });
  if (b.acepto !== true) return res.status(400).json({ error: 'Debes aceptar el Aviso de Privacidad.' });

  const registros = leer();
  if (registros.some(r => r.correo === correo)) return res.status(409).json({ error: 'Este correo ya está registrado.' });
  const reg: Registro = { id: crypto.randomUUID(), nombre, genero: b.genero, correo, telefono,
    nivel: b.nivel, escuela: nivelIdx >= 1 ? escuela : '', carrera: nivelIdx >= 4 ? carrera : '', fecha: new Date().toISOString(),
    consentimiento: { version: AVISO_VERSION, fecha: new Date().toISOString() } };
  // La foto vive en disco solo mientras se genera la credencial y se borra siempre.
  const tmp = fotoPath(reg.id);
  let png = Buffer.alloc(0);
  try {
    try {
      await sharp(fotoBuf).rotate().resize(600, 600, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88 }).toFile(tmp);
    } catch {
      return res.status(400).json({ error: 'La foto no es una imagen válida.' });
    }
    png = await generateCredential(reg.nombre, tmp);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'No se pudo generar la credencial. Intenta de nuevo.' });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  registros.push(reg);
  guardar(registros);
  res.json({ id: reg.id, credencial: png.toString('base64') });
});

// --- Admin ---
const sesiones = new Set<string>();
app.post('/api/login', (req: Request, res: Response) => {
  const { user, pass } = req.body ?? {};
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) return res.status(401).json({ error: 'Credenciales incorrectas.' });
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.add(token);
  res.json({ token });
});
const auth = (req: Request, res: Response, next: NextFunction) =>
  sesiones.has((req.headers.authorization ?? '').replace('Bearer ', '')) ? next() : res.status(401).json({ error: 'No autorizado' });
app.get('/api/admin/registros', auth, (_req, res) => res.json(leer()));

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => console.log(`http://localhost:${PORT}  (admin: /admin.html)`));
