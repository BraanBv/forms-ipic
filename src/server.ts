import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateCredential } from './credential';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const DB = path.join(__dirname, '../data/registros.json');
const ADMIN_USER = process.env.ADMIN_USER ?? 'carlos';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'carlosGym';
const NIVELES = ['Sin estudios', 'Primaria', 'Secundaria', 'Preparatoria / Bachillerato',
  'Carrera técnica / TSU (Técnico Superior Universitario)', 'Universidad (Licenciatura)',
  'Especialidad', 'Maestría', 'Doctorado'];
const GENEROS = ['Femenino', 'Masculino', 'Otro', 'Prefiero no decir'];

interface Registro { id: string; nombre: string; genero: string; correo: string; telefono: string;
  nivel: string; carrera: string; fecha: string; }

const leer = (): Registro[] => fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : [];
const guardar = (r: Registro[]) => fs.writeFileSync(DB, JSON.stringify(r, null, 2));

app.post('/api/registro', (req: Request, res: Response) => {
  const b = req.body ?? {};
  const nombre = String(b.nombre ?? '').trim();
  const correo = String(b.correo ?? '').trim().toLowerCase();
  const telefono = String(b.telefono ?? '').replace(/\D/g, '');
  const nivelIdx = NIVELES.indexOf(b.nivel);
  const carrera = String(b.carrera ?? '').trim();
  if (nombre.length < 5) return res.status(400).json({ error: 'Escribe tu nombre completo.' });
  if (!GENEROS.includes(b.genero)) return res.status(400).json({ error: 'Selecciona un género.' });
  if (!/^\S+@\S+\.\S+$/.test(correo)) return res.status(400).json({ error: 'Correo inválido.' });
  if (telefono.length !== 10) return res.status(400).json({ error: 'El celular debe tener 10 dígitos.' });
  if (nivelIdx < 0) return res.status(400).json({ error: 'Selecciona tu formación profesional.' });
  if (nivelIdx >= 4 && !carrera) return res.status(400).json({ error: 'Indica tu carrera / especialidad.' });

  const registros = leer();
  if (registros.some(r => r.correo === correo)) return res.status(409).json({ error: 'Este correo ya está registrado.' });
  const reg: Registro = { id: crypto.randomUUID(), nombre, genero: b.genero, correo, telefono,
    nivel: b.nivel, carrera: nivelIdx >= 4 ? carrera : '', fecha: new Date().toISOString() };
  registros.push(reg);
  guardar(registros);
  res.json({ id: reg.id });
});

app.get('/api/credencial/:id', async (req: Request, res: Response) => {
  const reg = leer().find(r => r.id === req.params.id);
  if (!reg) return res.status(404).json({ error: 'No encontrado' });
  const png = await generateCredential(reg.nombre);
  res.set({ 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="credencial.png"' });
  res.send(png);
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
