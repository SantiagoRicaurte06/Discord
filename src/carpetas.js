// Foro #archivos: cada publicación es una carpeta (una por proyecto + "General").
// El primer mensaje de cada carpeta es un índice ordenado de sus archivos con su respaldo en Drive.
import { ChannelType, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getDb, save, addArchivo } from './store.js';
import { COLORES, FORO_OPCIONES, ensureCanal } from './layout.js';

const GENERAL = 'general';

const TIPOS = [
  { nombre: '📄 Documentos', ext: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'] },
  { nombre: '📊 Hojas de cálculo', ext: ['xls', 'xlsx', 'csv', 'ods'] },
  { nombre: '📽️ Presentaciones', ext: ['ppt', 'pptx', 'key', 'odp'] },
  { nombre: '🖼️ Imágenes', ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'] },
  { nombre: '🎨 Diseño', ext: ['psd', 'ai', 'fig', 'xd', 'sketch', 'indd'] },
  { nombre: '🎬 Video y audio', ext: ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'm4a'] },
  { nombre: '🗜️ Comprimidos', ext: ['zip', 'rar', '7z', 'tar', 'gz'] },
  { nombre: '💻 Código', ext: ['js', 'ts', 'py', 'json', 'html', 'css', 'java', 'sql'] },
];
const OTROS = '📎 Otros';

export function tipoArchivo(nombre) {
  const ext = nombre.split('.').pop()?.toLowerCase();
  return TIPOS.find((t) => t.ext.includes(ext))?.nombre ?? OTROS;
}

const ORDEN = [...TIPOS.map((t) => t.nombre), OTROS];

function formatSize(bytes) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export const crearForo = (guild, { name, parent, permissionOverwrites }) => guild.channels.create({
  name, type: ChannelType.GuildForum, parent, permissionOverwrites, ...FORO_OPCIONES,
});

export const ensureForo = async (guild) => (await ensureCanal(guild, 'archivos')).canal;

// Foro donde vive la carpeta: el general o el privado del proyecto.
async function foroDe(guild, key) {
  if (key === GENERAL) return ensureForo(guild);
  const foro = await guild.channels.fetch(getDb().proyectos[key]?.foroId ?? '0').catch(() => null);
  if (!foro) throw new Error(`El proyecto ${key} no tiene canal de archivos`);
  return foro;
}

function nombreCarpeta(key) {
  return key === GENERAL ? 'General' : getDb().proyectos[key]?.nombre ?? key;
}

// Índice de la carpeta: archivos agrupados por tipo y ordenados alfabéticamente.
export function indiceEmbeds(key) {
  const db = getDb();
  const p = key === GENERAL ? null : db.proyectos[key];
  const archivos = db.archivos.filter((a) => (a.proyecto ?? GENERAL) === key);
  const sinRespaldo = archivos.filter((a) => !a.drive).length;

  const cabecera = [
    p?.drive ? `☁️ **Carpeta en Drive:** [abrir](${p.drive})` : null,
    p ? `💬 Chat del proyecto: <#${p.channelId}>` : 'Archivos generales del equipo, ordenados por tipo.',
    '',
    `**${archivos.length}** archivo(s) · ${sinRespaldo ? `⚠️ **${sinRespaldo}** sin respaldo en Drive` : '✅ todos con respaldo'}`,
  ].filter((l) => l !== null).join('\n');

  const bloques = [];
  for (const tipo of ORDEN) {
    const items = archivos.filter((a) => a.tipo === tipo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    if (!items.length) continue;
    const lineas = items.map((a) => {
      const drive = a.drive ? `[☁️ Drive](${a.drive})` : '⚠️ sin respaldo';
      const extra = [formatSize(a.tamaño), `<t:${Math.floor(new Date(a.fecha).getTime() / 1000)}:d>`].filter(Boolean).join(' · ');
      return `\`${String(a.id).padStart(3, '0')}\` **${a.nombre}** — [📎 Ver](${a.mensaje}) · ${drive}\n-# ${extra}${a.descripcion ? ` · ${a.descripcion}` : ''}`;
    });
    bloques.push(`### ${tipo} (${items.length})\n${lineas.join('\n')}`);
  }
  if (!bloques.length) bloques.push('*Carpeta vacía. Usa `/archivo subir` para agregar archivos.*');

  // Repartir en varios embeds si no cabe en uno (límite 4096 caracteres).
  const embeds = [];
  let actual = '';
  for (const b of bloques) {
    if ((actual + b).length > 3900 && actual) {
      embeds.push(actual);
      actual = '';
    }
    actual += `${b}\n\n`;
  }
  embeds.push(actual);

  return embeds.slice(0, 9).map((desc, i) => {
    const e = new EmbedBuilder().setColor(COLORES.archivos).setDescription(i === 0 ? `${cabecera}\n\n${desc}` : desc);
    if (i === 0) e.setTitle(`📂 ${nombreCarpeta(key)}`);
    return e;
  }).map((e, i, arr) => (i === arr.length - 1
    ? e.setFooter({ text: 'Índice automático · /archivo subir · /archivo respaldo' }).setTimestamp()
    : e));
}

export async function ensureCarpeta(guild, key) {
  const db = getDb();
  const foro = await foroDe(guild, key);
  const guardada = db.carpetas[key];
  if (guardada) {
    const thread = await guild.channels.fetch(guardada).catch(() => null);
    if (thread) {
      if (thread.archived) await thread.setArchived(false).catch(() => {});
      return thread;
    }
  }
  const thread = await foro.threads.create({
    name: `📂 ${nombreCarpeta(key)}`.slice(0, 100),
    message: { embeds: indiceEmbeds(key) },
  });
  if (key === GENERAL) await thread.pin().catch(() => {});
  db.carpetas[key] = thread.id;
  save();
  return thread;
}

export async function refrescarIndice(guild, key) {
  const thread = await ensureCarpeta(guild, key);
  const starter = await thread.fetchStarterMessage().catch(() => null);
  await starter?.edit({ embeds: indiceEmbeds(key) });
}

// Guarda un archivo en su carpeta: lo publica dentro del hilo y actualiza el índice.
export async function guardarArchivo(guild, { attachment, proyecto, drive, descripcion, autor, origen }) {
  const key = proyecto ?? GENERAL;
  const thread = await ensureCarpeta(guild, key);
  const tipo = tipoArchivo(attachment.name);
  const msg = await thread.send({
    content: [
      `${tipo.split(' ')[0]} **${attachment.name}**${descripcion ? ` — ${descripcion}` : ''}`,
      `Subido por <@${autor}>${origen ? ` · [mensaje original](${origen})` : ''}`,
      drive ? `☁️ Respaldo: ${drive}` : '⚠️ Sin respaldo en Drive — usa `/archivo respaldo` o responde a este mensaje con el link',
    ].join('\n'),
    files: [new AttachmentBuilder(attachment.url, { name: attachment.name })],
    allowedMentions: { parse: [] },
  });
  const archivo = addArchivo({
    nombre: attachment.name, tipo, tamaño: attachment.size, proyecto: proyecto ?? null,
    drive: drive ?? null, descripcion: descripcion ?? null, autor, mensaje: msg.url, mensajeId: msg.id, threadId: thread.id,
  });
  await refrescarIndice(guild, key);
  return { archivo, thread };
}

export async function asignarRespaldo(guild, archivo, drive) {
  archivo.drive = drive;
  save();
  const thread = await guild.channels.fetch(archivo.threadId).catch(() => null);
  const msg = await thread?.messages.fetch(archivo.mensajeId).catch(() => null);
  if (msg) {
    await msg.edit({ content: msg.content.replace(/^(⚠️ Sin respaldo.*|☁️ Respaldo: .*)$/m, `☁️ Respaldo: ${drive}`) }).catch(() => {});
  }
  await refrescarIndice(guild, archivo.proyecto ?? GENERAL);
}

export function archivoPorMensaje(messageId) {
  return getDb().archivos.find((a) => a.mensajeId === messageId);
}

export { GENERAL };
