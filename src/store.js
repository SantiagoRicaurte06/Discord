// Almacenamiento simple en un archivo JSON (data/db.json).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');
const EMPTY = { proyectos: {}, links: [], ideas: [], archivos: [] };

function load() {
  if (!existsSync(DB_PATH)) return structuredClone(EMPTY);
  return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(DB_PATH, 'utf8')) };
}

let db = load();

export function save() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
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
  db.archivos.push({ ...a, fecha: new Date().toISOString() });
  save();
}
