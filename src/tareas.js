// Tareas por proyecto:
// - 📋・tareas: issues del repo de GitHub, solo lectura: se marcan como hechas cuando se cierran en GitHub.
//   El bot nunca modifica nada en GitHub.
// - 🧩・tareas-extra: tareas o arreglos agregados con /tarea-extra, con un select para marcarlas como hechas.
// Ambos canales son de solo lectura para los miembros; el tablero es un mensaje fijo que el bot actualiza.
import {
  ActionRowBuilder, ChannelType, EmbedBuilder, LabelBuilder, ModalBuilder, PermissionFlagsBits,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getDb, save } from './store.js';
import { COLORES, PROYECTO } from './layout.js';
import { parseRepo } from './github.js';
import { refrescarTarjetaDeProyecto } from './tarjetas.js';

const INTERVALO_MS = 5 * 60 * 1000;
const TIPOS_EXTRA = { tarea: '🧩 Tarea', arreglo: '🔧 Arreglo' };

const CANALES = {
  github: { campo: 'tareasId', tablero: 'tableroTareasId', nombre: () => PROYECTO.tareas, tema: 'Issues del repositorio de GitHub · se marcan solos cuando se cierran en GitHub' },
  extra: { campo: 'extraId', tablero: 'tableroExtraId', nombre: () => PROYECTO.tareasExtra, tema: 'Tareas y arreglos fuera de los issues · /tarea-extra para agregar' },
};

// ---------- canales ----------

async function ensureCanal(guild, p, origen) {
  const def = CANALES[origen];
  let canal = p[def.campo] && await guild.channels.fetch(p[def.campo]).catch(() => null);
  if (canal) return canal;
  canal = await guild.channels.create({
    name: def.nombre(), type: ChannelType.GuildText, parent: p.categoryId, topic: def.tema,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: p.roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.UseApplicationCommands],
        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads],
      },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
    ],
  });
  p[def.campo] = canal.id;
  p[def.tablero] = null;
  save();
  return canal;
}

export async function ensureCanalesTareas(guild, p) {
  p.tareas ??= [];
  for (const origen of Object.keys(CANALES)) {
    await ensureCanal(guild, p, origen);
    await refrescarTablero(guild, p, origen);
  }
}

// ---------- tablero ----------

const linea = (t) => {
  const etiqueta = t.origen === 'github' ? `[#${t.numero}](${t.url})` : TIPOS_EXTRA[t.tipo] ?? '🧩';
  const titulo = t.estado === 'hecha' ? `~~${t.titulo}~~` : `**${t.titulo}**`;
  const quien = t.estado === 'hecha' && t.hechaPor ? ` · ✅ <@${t.hechaPor}>` : '';
  return `${t.estado === 'hecha' ? '✅' : '⬜'} ${etiqueta} ${titulo}${quien}`;
};

function tablero(p, origen) {
  const tareas = (p.tareas ?? []).filter((t) => t.origen === origen);
  const abiertas = tareas.filter((t) => t.estado !== 'hecha');
  const hechas = tareas.filter((t) => t.estado === 'hecha').slice(-15);
  const total = tareas.length;
  const pct = total ? Math.round(((total - abiertas.length) / total) * 100) : 0;

  const titulo = origen === 'github' ? `📋 Tareas · ${p.nombre}` : `🧩 Tareas extra · ${p.nombre}`;
  let encabezado;
  if (origen === 'github') {
    const repo = parseRepo(p.github);
    encabezado = repo
      ? `Issues de [${repo.owner}/${repo.repo}](${p.github}) · se sincronizan cada 5 min.\nSe marcan ✅ automáticamente cuando se cierran en GitHub.`
      : 'Este proyecto no tiene repositorio de GitHub. Agrégalo con ✏️ Editar en la ficha.';
    if (p.errorIssues) encabezado += `\n⚠️ ${p.errorIssues}`;
  } else {
    encabezado = 'Tareas y arreglos que no están en los issues. Agrégalos con `/tarea-extra` en este canal.';
  }

  const cuerpo = [
    encabezado,
    '',
    `**Progreso:** ${'▰'.repeat(Math.round(pct / 10))}${'▱'.repeat(10 - Math.round(pct / 10))} ${pct}% · ${total - abiertas.length}/${total}`,
    '',
    abiertas.length ? `**Pendientes (${abiertas.length})**\n${abiertas.slice(0, 40).map(linea).join('\n')}` : '**Pendientes:** ninguna 🎉',
    hechas.length ? `\n**Realizadas recientes**\n${hechas.map(linea).join('\n')}` : '',
  ].join('\n').slice(0, 4000);

  const embed = new EmbedBuilder().setColor(origen === 'github' ? COLORES.github : COLORES.primario)
    .setTitle(titulo).setDescription(cuerpo).setTimestamp();

  // Los issues solo cambian desde GitHub: su tablero no tiene menús.
  const components = [];
  if (origen === 'extra' && abiertas.length) {
    components.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`tarea-hecha:${p.id}:${origen}`)
        .setPlaceholder('Marcar como realizadas…')
        .setMinValues(1)
        .setMaxValues(Math.min(abiertas.length, 25))
        .addOptions(abiertas.slice(0, 25).map((t) => new StringSelectMenuOptionBuilder()
          .setValue(t.id)
          .setLabel(`${t.origen === 'github' ? `#${t.numero} ` : ''}${t.titulo}`.slice(0, 100))
          .setDescription((t.origen === 'github' ? 'Issue de GitHub' : TIPOS_EXTRA[t.tipo] ?? 'Tarea').slice(0, 100)))),
    ));
  }
  if (origen === 'extra' && hechas.length) {
    components.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`tarea-reabrir:${p.id}:${origen}`)
        .setPlaceholder('Reabrir una tarea…')
        .addOptions(hechas.slice(-25).map((t) => new StringSelectMenuOptionBuilder()
          .setValue(t.id).setLabel(`${t.origen === 'github' ? `#${t.numero} ` : ''}${t.titulo}`.slice(0, 100)))),
    ));
  }
  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

export async function refrescarTablero(guild, p, origen) {
  const def = CANALES[origen];
  const canal = await guild.channels.fetch(p[def.campo] ?? '0').catch(() => null);
  if (!canal) return;
  const contenido = tablero(p, origen);
  const previo = p[def.tablero] && await canal.messages.fetch(p[def.tablero]).catch(() => null);
  if (previo) {
    await previo.edit(contenido);
    return;
  }
  const msg = await canal.send(contenido);
  await msg.pin().catch(() => {});
  const aviso = (await canal.messages.fetch({ limit: 5 }).catch(() => null))?.find((x) => x.system);
  await aviso?.delete().catch(() => {});
  p[def.tablero] = msg.id;
  save();
}

// ---------- GitHub ----------

const headers = () => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'discord-organizador',
  ...(process.env.GITHUB_PAT ? { Authorization: `Bearer ${process.env.GITHUB_PAT}` } : {}),
});

export async function sincronizarIssues(guild, p) {
  const repo = parseRepo(p.github);
  if (!repo) return;
  const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/issues?state=all&per_page=100&sort=created&direction=asc`, {
    headers: { ...headers(), ...(p.issuesEtag ? { 'If-None-Match': p.issuesEtag } : {}) },
  });
  if (res.status === 304) return;
  if (!res.ok) {
    const sinCupo = res.headers.get('x-ratelimit-remaining') === '0';
    let error = `GitHub respondió ${res.status}.`;
    if (sinCupo) error = 'GitHub limitó las consultas sin token; se reintentará solo. Un GITHUB_PAT lo evita.';
    else if (res.status === 404 || res.status === 403) error = 'No se pudo leer el repo (¿es privado? se necesita GITHUB_PAT).';
    if (p.errorIssues !== error) {
      p.errorIssues = error;
      save();
      await refrescarTablero(guild, p, 'github');
    }
    return;
  }
  p.issuesEtag = res.headers.get('etag');
  p.errorIssues = null;
  p.tareas ??= [];
  for (const issue of (await res.json()).filter((i) => !i.pull_request)) {
    const id = `gh-${issue.number}`;
    const estado = issue.state === 'closed' ? 'hecha' : 'abierta';
    const t = p.tareas.find((x) => x.id === id);
    if (!t) {
      p.tareas.push({ id, origen: 'github', numero: issue.number, titulo: issue.title, url: issue.html_url, estado, fecha: issue.created_at });
    } else {
      t.titulo = issue.title;
      if (t.estado !== estado) {
        t.estado = estado;
        if (estado === 'abierta') t.hechaPor = null;
      }
    }
  }
  save();
  await refrescarTablero(guild, p, 'github');
  await refrescarTarjetaDeProyecto(guild, p.id);
}

export function iniciarSincronizacion(client, guildId) {
  const ciclo = async () => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    for (const p of Object.values(getDb().proyectos)) {
      if (p.archivado || !p.github || !p.tareasId) continue;
      await sincronizarIssues(guild, p).catch((e) => console.error(`Issues de ${p.id}:`, e.message));
    }
  };
  ciclo();
  return setInterval(ciclo, INTERVALO_MS);
}

// ---------- acciones ----------

// Solo tareas extra: los issues de GitHub cambian únicamente desde GitHub.
export async function marcar(guild, p, ids, userId, hecha) {
  const cambiadas = p.tareas.filter((x) => x.origen === 'extra' && ids.includes(x.id));
  for (const t of cambiadas) {
    t.estado = hecha ? 'hecha' : 'abierta';
    t.hechaPor = hecha ? userId : null;
  }
  save();
  if (cambiadas.length) await refrescarTablero(guild, p, 'extra');
  return cambiadas;
}

export const modalTareaExtra = () => new ModalBuilder()
  .setCustomId('tarea-extra')
  .setTitle('Nueva tarea extra')
  .addLabelComponents(
    new LabelBuilder().setLabel('Título').setTextInputComponent(
      new TextInputBuilder().setCustomId('titulo').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90),
    ),
    new LabelBuilder().setLabel('Tipo').setStringSelectMenuComponent(
      new StringSelectMenuBuilder().setCustomId('tipo').setRequired(true).addOptions(
        { label: 'Tarea', value: 'tarea', emoji: '🧩', default: true },
        { label: 'Arreglo', value: 'arreglo', emoji: '🔧' },
      ),
    ),
    new LabelBuilder().setLabel('Detalle (opcional)').setTextInputComponent(
      new TextInputBuilder().setCustomId('detalle').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500),
    ),
  );

export async function agregarTareaExtra(guild, p, { titulo, tipo, detalle, autor }) {
  p.tareas ??= [];
  p.siguienteExtra = (p.siguienteExtra ?? 0) + 1;
  const t = {
    id: `x-${p.siguienteExtra}`, origen: 'extra', tipo, titulo, detalle: detalle || null, autor, estado: 'abierta', fecha: new Date().toISOString(),
  };
  p.tareas.push(t);
  save();
  await refrescarTablero(guild, p, 'extra');
  return t;
}

export const proyectoPorCanalExtra = (channelId) => Object.values(getDb().proyectos).find((p) => p.extraId === channelId);
