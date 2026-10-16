// Revisión diaria de las skills publicadas en 🧠・skills (skills/catalogo.json).
// Descarga los archivos de cada skill desde GitHub (raw, sin gastar la API) y compara su huella con la anterior.
// Si cambió: avisa dentro de la publicación con qué cambió y cómo actualizar; en las skills propias
// ("adjuntar": true) reemplaza también los archivos adjuntos. RTK se sigue por su versión en Homebrew.
// Se ejecuta a SKILLS_HORA (2 por defecto) en la zona RESUMEN_TZ.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { getDb, save } from './store.js';
import { COLORES, canal } from './layout.js';
import { ahoraLocal } from './resumen.js';

const CATALOGO = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'catalogo.json');
const HORA = () => Number(process.env.SKILLS_HORA ?? 2);
const UA = { 'User-Agent': 'discord-organizador' };

const catalogo = () => JSON.parse(readFileSync(CATALOGO, 'utf8'));
const huella = (texto) => createHash('sha256').update(texto).digest('hex').slice(0, 16);

async function bajar(repo, ruta) {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${ruta}`, { headers: UA });
  if (!res.ok) throw new Error(`${ruta}: GitHub respondió ${res.status}`);
  return res.text();
}

async function versionBrew(formula) {
  const res = await fetch(`https://formulae.brew.sh/api/formula/${formula}.json`, { headers: UA });
  if (!res.ok) throw new Error(`Homebrew respondió ${res.status}`);
  return (await res.json()).versions.stable;
}

// Último commit de un archivo (opcional: si la API no responde, se omite).
async function ultimoCommit(repo, ruta) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(ruta)}&per_page=1`, {
      headers: { ...UA, Accept: 'application/vnd.github+json', ...(process.env.GITHUB_PAT ? { Authorization: `Bearer ${process.env.GITHUB_PAT}` } : {}) },
    });
    if (!res.ok) return null;
    const [c] = await res.json();
    return c ? { mensaje: c.commit.message.split('\n')[0].slice(0, 120), url: c.html_url, fecha: c.commit.committer?.date } : null;
  } catch {
    return null;
  }
}

// Estado actual de una skill: { huellas: {archivo: huella}, contenidos, version }
async function estadoActual(s) {
  if (s.brew) return { version: await versionBrew(s.brew), huellas: {}, contenidos: {} };
  const huellas = {};
  const contenidos = {};
  for (const ruta of s.archivos) {
    contenidos[ruta] = await bajar(s.repo, ruta);
    huellas[ruta] = huella(contenidos[ruta]);
  }
  return { huellas, contenidos, version: null };
}

async function hiloDe(foro, nombreHilo) {
  const activos = await foro.threads.fetchActive();
  const archivados = await foro.threads.fetchArchived({ limit: 100 }).catch(() => ({ threads: new Map() }));
  return [...activos.threads.values(), ...archivados.threads.values()].find((t) => t.name.includes(nombreHilo)) ?? null;
}

async function avisar(hilo, s, { cambiados, version, versionAnterior, commits }) {
  if (hilo.archived) await hilo.setArchived(false).catch(() => {});
  const lineas = s.brew
    ? [`Nueva versión: **${versionAnterior} → ${version}**`, `[Notas de la versión](https://github.com/${s.repo}/releases)`]
    : cambiados.map((ruta) => {
      const c = commits[ruta];
      return `› \`${basename(dirname(ruta))}/${basename(ruta)}\`${c ? ` — [${c.mensaje}](${c.url})` : ` — [ver historial](https://github.com/${s.repo}/commits/HEAD/${ruta})`}`;
    });
  const embed = new EmbedBuilder().setColor(COLORES.aviso)
    .setTitle(`🔄 ${s.nombre} se actualizó`)
    .setDescription([
      ...lineas,
      '',
      '**Para actualizar:**',
      `\`\`\`bash\n${s.actualizar}\n\`\`\``,
      s.adjuntar ? '-# Los archivos adjuntos de la publicación ya están al día.' : '',
    ].filter(Boolean).join('\n'))
    .setTimestamp();
  await hilo.send({ embeds: [embed] });

  // Marca la publicación con la fecha de la última actualización (y archivos nuevos si es propia).
  const inicio = await hilo.fetchStarterMessage().catch(() => null);
  if (inicio?.author.id === hilo.client.user.id) {
    const embeds = inicio.embeds.map((e, i) => (i === 0
      ? EmbedBuilder.from(e).setFooter({ text: `${(e.footer?.text ?? '').replace(/ · actualizada .*$/, '')} · actualizada ${new Date().toLocaleDateString('es-CO')}` })
      : EmbedBuilder.from(e)));
    const edicion = { embeds };
    if (s.adjuntar && s.contenidos) {
      edicion.attachments = [];
      edicion.files = Object.entries(s.contenidos).map(([ruta, texto]) => new AttachmentBuilder(Buffer.from(texto), { name: basename(ruta) }));
    }
    await inicio.edit(edicion).catch((e) => console.error(`Editando publicación de ${s.nombre}:`, e.message));
  }
}

// Revisa todas las skills del catálogo. La primera vez solo guarda la referencia (no avisa).
export async function revisarSkills(guild) {
  const foro = canal(guild, 'skills');
  if (!foro) return [];
  const db = getDb();
  db.skillsVigiladas ??= {};
  const resultados = [];

  for (const s of catalogo()) {
    const previo = db.skillsVigiladas[s.nombre];
    try {
      const actual = await estadoActual(s);
      const cambiados = previo ? Object.keys(actual.huellas).filter((r) => previo.huellas?.[r] !== actual.huellas[r]) : [];
      const versionCambio = s.brew && previo?.version && previo.version !== actual.version;
      if (previo && (cambiados.length || versionCambio)) {
        const hilo = await hiloDe(foro, s.hilo);
        const commits = {};
        for (const ruta of cambiados) commits[ruta] = await ultimoCommit(s.repo, ruta);
        if (hilo) await avisar(hilo, { ...s, contenidos: actual.contenidos }, { cambiados, version: actual.version, versionAnterior: previo.version, commits });
        resultados.push({ nombre: s.nombre, estado: 'actualizada', detalle: s.brew ? `${previo.version} → ${actual.version}` : `${cambiados.length} archivo(s)`, hilo: !!hilo });
      } else {
        resultados.push({ nombre: s.nombre, estado: previo ? 'sin cambios' : 'referencia guardada' });
      }
      db.skillsVigiladas[s.nombre] = { huellas: actual.huellas, version: actual.version, revisadaEn: new Date().toISOString() };
    } catch (err) {
      resultados.push({ nombre: s.nombre, estado: 'error', detalle: err.message });
    }
  }
  db.ultimaRevisionSkills = new Date().toISOString();
  save();
  return resultados;
}

export function iniciarRevisionSkills(client, guildId) {
  const revisar = async () => {
    const { fecha, hora } = ahoraLocal();
    const db = getDb();
    if (hora < HORA() || db.ultimaFechaSkills === fecha) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    db.ultimaFechaSkills = fecha;
    save();
    const r = await revisarSkills(guild).catch((e) => console.error('Revisión de skills:', e.message));
    if (r) console.log(`🔄 Skills revisadas: ${r.map((x) => `${x.nombre}=${x.estado}`).join(', ')}`);
  };
  revisar();
  return setInterval(revisar, 15 * 60 * 1000);
}
