// Almacenamiento simple en un archivo JSON (data/db.json).
// Guardado atómico (archivo temporal + rename) para que un corte de luz no deje el archivo a medias,
// y una copia diaria en data/backups/ (se conservan las últimas BACKUPS_DIAS).
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, unlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// DATA_DIR permite guardar la base en un volumen persistente al desplegar.
const DATA_DIR = process.env.DATA_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const DB_PATH = join(DATA_DIR, 'db.json');
const BACKUP_DIR = join(DATA_DIR, 'backups');
const BACKUPS_DIAS = 14;
const EMPTY = {
  proyectos: {}, links: [], ideas: [], archivos: [], carpetas: {}, usuarios: {},
};

function leer(ruta) {
  return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(ruta, 'utf8')) };
}

// Si db.json está dañado, arranca con la copia más reciente que se pueda leer.
// Si no existe y hay DB_SEMILLA_B64 (db.json en base64), arranca con ella: sirve para migrar a otro servidor.
function load() {
  if (!existsSync(DB_PATH) && process.env.DB_SEMILLA_B64) {
    const semilla = JSON.parse(Buffer.from(process.env.DB_SEMILLA_B64, 'base64').toString('utf8'));
    mkdirSync(dirname(DB_PATH), { recursive: true });
    writeFileSync(DB_PATH, JSON.stringify(semilla, null, 2));
    console.log(`📦 Base de datos inicial cargada desde DB_SEMILLA_B64 en ${DB_PATH}. Ya puedes borrar esa variable.`);
  }
  if (!existsSync(DB_PATH)) return structuredClone(EMPTY);
  try {
    return leer(DB_PATH);
  } catch (err) {
    const copias = existsSync(BACKUP_DIR) ? readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort().reverse() : [];
    for (const f of copias) {
      try {
        const datos = leer(join(BACKUP_DIR, f));
        console.warn(`⚠️ db.json dañado (${err.message}); se restauró la copia ${f}`);
        return datos;
      } catch { /* probar la siguiente */ }
    }
    throw err;
  }
}

function backupDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  const destino = join(BACKUP_DIR, `db-${hoy}.json`);
  if (existsSync(destino)) return;
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(destino, JSON.stringify(db, null, 2));
  const viejas = readdirSync(BACKUP_DIR).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -BACKUPS_DIAS);
  for (const f of viejas) unlinkSync(join(BACKUP_DIR, f));
}

let db = load();

// ¿DATA_DIR está en un volumen montado? Sin volumen, en Railway/Docker el archivo se borra en cada despliegue.
// Devuelve true/false en Linux, o null si no se puede saber.
export function almacenamiento() {
  let persistente = null;
  try {
    const puntos = readFileSync('/proc/self/mountinfo', 'utf8').split('\n').map((l) => l.split(' ')[4]).filter(Boolean);
    const ruta = resolve(DATA_DIR);
    persistente = puntos.some((m) => m !== '/' && (ruta === m || ruta.startsWith(`${m}/`)));
  } catch { /* no es Linux */ }
  return { ruta: DB_PATH, persistente, proyectos: Object.keys(db.proyectos).length };
}

export function save() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  backupDiario();
  const tmp = `${DB_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
}

export const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);

export const getDb = () => db;

export function addProyecto(p) {
  db.proyectos[p.id] = p;
  save();
  return p;
}

export function findProyecto(nombre) {
  return db.proyectos[slug(nombre)];
}

export function findProyectoByChannel(channelId) {
  return Object.values(db.proyectos).find((p) => p.channelId === channelId);
}

export function addLink(link) {
  if (db.links.some((l) => l.url === link.url && l.proyecto === link.proyecto)) return null;
  db.links.push({ ...link, fecha: new Date().toISOString() });
  save();
  return link;
}

export function addIdea(idea) {
  const id = (db.ideas.at(-1)?.id ?? 0) + 1;
  db.ideas.push({ id, ...idea, fecha: new Date().toISOString() });
  save();
  return id;
}

export function addArchivo(a) {
  const id = (db.archivos.at(-1)?.id ?? 0) + 1;
  const archivo = { id, ...a, fecha: new Date().toISOString() };
  db.archivos.push(archivo);
  save();
  return archivo;
}

// Cuenta de GitHub vinculada a cada usuario de Discord.
export const githubDe = (discordId) => db.usuarios[discordId]?.github ?? null;

export function vincularGithub(discordId, login) {
  db.usuarios[discordId] = { ...db.usuarios[discordId], github: login };
  save();
}

export function desvincularGithub(discordId) {
  if (db.usuarios[discordId]) delete db.usuarios[discordId].github;
  save();
}

// Usuario de Discord con esa cuenta de GitHub vinculada (o null).
export const discordDeGithub = (login) => Object.entries(db.usuarios)
  .find(([, u]) => u.github?.toLowerCase() === login?.toLowerCase())?.[0] ?? null;
