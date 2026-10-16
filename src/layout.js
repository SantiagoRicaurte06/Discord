// Estilo y estructura del servidor. Todos los nombres, íconos y colores viven aquí.
// Los canales se localizan por el ID guardado en data/db.json, así que se pueden renombrar sin romper el bot.
import { ChannelType, ForumLayoutType, SortOrderType } from 'discord.js';
import { getDb, save } from './store.js';

export const SEP = '・';

export const COLORES = {
  primario: 0x5865f2,
  exito: 0x3ba55d,
  aviso: 0xf0b232,
  drive: 0x1a73e8,
  archivos: 0x9b59b6,
  github: 0x24292f,
  ideas: 0xf1c40f,
};

// Proyectos: ◆ activo, ◇ archivado.
export const PROYECTO = {
  categoria: (nombre) => `◆ ${nombre}`,
  archivada: (nombre) => `◇ ${nombre}`,
  rol: (nombre) => `◆ ${nombre}`,
  chat: `💬${SEP}chat`,
  archivos: `📁${SEP}archivos`,
  commits: `📡${SEP}commits`,
  tareas: `📋${SEP}tareas`,
  tareasExtra: `🧩${SEP}tareas-extra`,
  voz: '🎙️ Reunión',
};

export const FORO_OPCIONES = {
  topic: 'El primer mensaje de cada carpeta es el índice con los archivos y su respaldo en Drive. Sube archivos con /archivo subir.',
  defaultForumLayout: ForumLayoutType.ListView,
  defaultSortOrder: SortOrderType.CreationDate,
};

// Orden de las categorías = orden en el servidor. Los proyectos se agregan al final.
export const CATEGORIAS = {
  info: { nombre: '📌 INFORMACIÓN', antes: ['📌 GENERAL'] },
  comunidad: { nombre: '💬 COMUNIDAD', antes: [] },
  recursos: { nombre: '🗂️ RECURSOS', antes: ['🔗 RECURSOS'] },
  voz: { nombre: '🎧 VOZ', antes: ['🔊 VOZ', 'Canales de voz'] },
};

const TEXTO = ChannelType.GuildText;
const VOZ = ChannelType.GuildVoice;
const FORO = ChannelType.GuildForum;

// Orden dentro de cada categoría = orden en esta lista.
export const CANALES = {
  funcionamiento: { nombre: `📖${SEP}funcionamiento`, cat: 'info', tipo: TEXTO, antes: [`👋${SEP}bienvenida`, 'bienvenida'], tema: 'Funciones, comandos y roles del servidor' },
  anuncios: { nombre: `📣${SEP}anuncios`, cat: 'info', tipo: TEXTO, antes: ['anuncios'], tema: 'Novedades importantes' },
  crear: { nombre: `🚀${SEP}crear-proyectos`, cat: 'info', tipo: TEXTO, antes: ['crear-proyectos'] },
  general: { nombre: `💬${SEP}general`, cat: 'comunidad', tipo: TEXTO, antes: ['general'], tema: 'Conversación libre' },
  ideas: { nombre: `💡${SEP}ideas`, cat: 'comunidad', tipo: TEXTO, antes: ['ideas'], tema: 'Usa /idea-base para proponer una idea · 3 ✅ la aprueban · 3 ❌ la descartan' },
  ideasAprobadas: { nombre: `🏆${SEP}proyectos-aprobados`, cat: 'comunidad', tipo: TEXTO, antes: [`✅${SEP}ideas-aprobadas`, 'ideas-aprobadas'], tema: 'Ideas aprobadas con su estado y progreso' },
  linksDrive: { nombre: `🔗${SEP}links-drive`, cat: 'recursos', tipo: TEXTO, antes: ['links-drive'], tema: 'Registro de los links de Google Drive' },
  archivos: { nombre: `📁${SEP}archivos`, cat: 'recursos', tipo: FORO, antes: ['archivos'] },
  vozGeneral: { nombre: '🎙️ Sala general', cat: 'voz', tipo: VOZ, antes: ['🔊 General', 'General'] },
  afk: { nombre: '💤 Ausente', cat: 'voz', tipo: VOZ, antes: ['💤 AFK'] },
};

// Los canales dentro de categorías de proyecto nunca cuentan como canales generales.
const esDeProyecto = (c) => /^[◆◇📁🗄]/u.test(c.parent?.name ?? '');

function localizar(guild, registro, key, { nombre, antes = [] }, tipo) {
  const db = getDb();
  db[registro] ??= {};
  const guardado = guild.channels.cache.get(db[registro][key] ?? '');
  if (guardado) return guardado;
  const nombres = [nombre, ...antes];
  const encontrado = guild.channels.cache.find((c) => c.type === tipo && nombres.includes(c.name) && !esDeProyecto(c));
  if (encontrado) {
    db[registro][key] = encontrado.id;
    save();
  }
  return encontrado;
}

export const categoria = (guild, key) => localizar(guild, 'categorias', key, CATEGORIAS[key], ChannelType.GuildCategory);
export const canal = (guild, key) => localizar(guild, 'canales', key, CANALES[key], CANALES[key].tipo);

export async function ensureCategoria(guild, key) {
  const def = CATEGORIAS[key];
  let cat = categoria(guild, key);
  if (!cat) {
    cat = await guild.channels.create({ name: def.nombre, type: ChannelType.GuildCategory });
    getDb().categorias[key] = cat.id;
    save();
  } else if (cat.name !== def.nombre) {
    await cat.setName(def.nombre);
  }
  return cat;
}

// Busca o crea el canal y lo deja con el nombre y la categoría del estilo actual.
export async function ensureCanal(guild, key, extra = {}) {
  const def = CANALES[key];
  const cat = await ensureCategoria(guild, def.cat);
  let c = canal(guild, key);
  let creado = false;
  if (!c) {
    c = await guild.channels.create({
      name: def.nombre, type: def.tipo, parent: cat.id,
      ...(def.tema ? { topic: def.tema } : {}),
      ...(def.tipo === FORO ? FORO_OPCIONES : {}),
      ...extra,
    });
    getDb().canales[key] = c.id;
    save();
    creado = true;
  } else if (c.name !== def.nombre || c.parentId !== cat.id) {
    await c.edit({ name: def.nombre, parent: cat.id, lockPermissions: false });
  }
  return { canal: c, creado };
}

// Ordena categorías y canales según las listas de arriba.
export async function ordenar(guild) {
  const posiciones = [];
  Object.keys(CATEGORIAS).forEach((key, i) => {
    const cat = categoria(guild, key);
    if (cat) posiciones.push({ channel: cat.id, position: i });
  });
  for (const catKey of Object.keys(CATEGORIAS)) {
    Object.entries(CANALES).filter(([, d]) => d.cat === catKey).forEach(([key], i) => {
      const c = canal(guild, key);
      if (c) posiciones.push({ channel: c.id, position: i });
    });
  }
  await guild.channels.setPositions(posiciones);
}

// Menciona un canal general (#nombre) o su nombre si aún no existe.
export const mencion = (guild, key) => {
  const c = guild && canal(guild, key);
  return c ? `<#${c.id}>` : `#${CANALES[key].nombre}`;
};
