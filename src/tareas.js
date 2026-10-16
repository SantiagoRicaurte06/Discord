// Tareas por proyecto:
// - 📋・tareas: issues del repo de GitHub, solo lectura: se marcan como hechas cuando se cierran en GitHub.
//   El bot nunca modifica nada en GitHub.
// - 🧩・tareas-extra: arreglos y añadidos cuando el proyecto ya está en producción (todos los issues cerrados).
//   Se agregan con /tarea-extra y se marcan con un select.
// Ambos canales son de solo lectura para los miembros; el tablero es un mensaje fijo que el bot actualiza.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, LabelBuilder, ModalBuilder, PermissionFlagsBits,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getDb, save, discordDeGithub } from './store.js';
import { COLORES, PROYECTO } from './layout.js';
import { parseRepo } from './github.js';
import { refrescarTarjetaDeProyecto, avance } from './tarjetas.js';

const INTERVALO_MS = 5 * 60 * 1000;
const TIPOS_EXTRA = { tarea: '🧩 Tarea', arreglo: '🔧 Arreglo' };

const CANALES = {
  github: { campo: 'tareasId', tablero: 'tableroTareasId', nombre: () => PROYECTO.tareas, tema: 'Issues del repositorio de GitHub · se marcan solos cuando se cierran en GitHub' },
  extra: { campo: 'extraId', tablero: 'tableroExtraId', nombre: () => PROYECTO.tareasExtra, tema: 'Arreglos y añadidos con el proyecto en producción · /tarea-extra para agregar' },
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

// GitHub login → mención de Discord si la cuenta está vinculada.
const persona = (login) => {
  const id = discordDeGithub(login);
  return id ? `<@${id}>` : `\`${login}\``;
};

const prDe = (p, t) => (p.prs ?? []).find((pr) => pr.issues.includes(t.numero));

const linea = (p, t) => {
  const etiqueta = t.origen === 'github' ? `[#${t.numero}](${t.url})` : TIPOS_EXTRA[t.tipo] ?? '🧩';
  const titulo = t.estado === 'hecha' ? `~~${t.titulo}~~` : `**${t.titulo}**`;
  const extras = [];
  if (t.estado === 'hecha') {
    if (t.hechaPor) extras.push(`✅ <@${t.hechaPor}>`);
  } else if (t.origen === 'github') {
    extras.push(t.asignados?.length ? `👤 ${t.asignados.map(persona).join(' ')}` : '👤 *sin asignar*');
    const pr = prDe(p, t);
    if (pr) extras.push(`🔍 [PR #${pr.numero}](${pr.url})${pr.revisores.length ? ` revisa ${pr.revisores.map(persona).join(' ')}` : ''}`);
  }
  const icono = t.estado === 'hecha' ? '✅' : (t.origen === 'github' && prDe(p, t) ? '🔍' : '⬜');
  return `${icono} ${etiqueta} ${titulo}${extras.length ? ` · ${extras.join(' · ')}` : ''}`;
};

function tablero(p, origen) {
  const tareas = (p.tareas ?? []).filter((t) => t.origen === origen);
  const abiertas = tareas.filter((t) => t.estado !== 'hecha');
  const hechas = tareas.filter((t) => t.estado === 'hecha').slice(-15);
  const total = tareas.length;
  const pct = total ? Math.round(((total - abiertas.length) / total) * 100) : 0;

  const titulo = origen === 'github' ? `📋 Tareas · ${p.nombre}` : `🧩 Tareas extra · ${p.nombre}`;
  // PRs abiertos que no cierran ningún issue listado: también se muestran como "en revisión".
  const sueltos = origen === 'github' ? (p.prs ?? []).filter((pr) => !pr.issues.some((n) => abiertas.some((t) => t.numero === n))) : [];
  const revision = sueltos.length
    ? `\n**🔍 PRs en revisión**\n${sueltos.slice(0, 10).map((pr) => `🔍 [#${pr.numero}](${pr.url}) **${pr.titulo}** · de ${persona(pr.autor)}${pr.revisores.length ? ` · revisa ${pr.revisores.map(persona).join(' ')}` : ''}`).join('\n')}`
    : '';
  let encabezado;
  if (origen === 'github') {
    const repo = parseRepo(p.github);
    encabezado = repo
      ? `Issues de [${repo.owner}/${repo.repo}](${p.github}) · se sincronizan cada 5 min.\nSe marcan ✅ automáticamente cuando se cierran en GitHub.`
      : 'Este proyecto no tiene repositorio de GitHub. Agrégalo con ✏️ Editar en la ficha.';
    if (p.errorIssues) encabezado += `\n⚠️ ${p.errorIssues}`;
  } else {
    encabezado = avance(p).enProduccion
      ? '🚀 El proyecto está en producción: agrega arreglos y añadidos con `/tarea-extra` en este canal.'
      : '🔒 Las tareas extra se habilitan cuando el proyecto llega a **producción** (todos los issues cerrados). Antes de eso, todo va como issue en GitHub.';
  }

  const cuerpo = [
    encabezado,
    '',
    `**Progreso:** ${'▰'.repeat(Math.round(pct / 10))}${'▱'.repeat(10 - Math.round(pct / 10))} ${pct}% · ${total - abiertas.length}/${total}`,
    '',
    abiertas.length ? `**Pendientes (${abiertas.length})**\n${abiertas.slice(0, 30).map((t) => linea(p, t)).join('\n')}` : '**Pendientes:** ninguna 🎉',
    revision,
    hechas.length ? `\n**Realizadas recientes**\n${hechas.map((t) => linea(p, t)).join('\n')}` : '',
  ].join('\n').slice(0, 4000);

  const embed = new EmbedBuilder().setColor(origen === 'github' ? COLORES.github : COLORES.primario)
    .setTitle(titulo).setDescription(cuerpo).setTimestamp();

  // Los issues solo cambian desde GitHub: su tablero solo tiene el botón para sincronizar al momento.
  const components = [];
  if (origen === 'github' && p.github) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`tareas-sync:${p.id}`).setLabel('Sincronizar ahora').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setURL(`${p.github.replace(/\.git$/, '')}/issues`).setLabel('Issues en GitHub').setStyle(ButtonStyle.Link),
    ));
  }
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

const api = (ruta, etag) => fetch(`https://api.github.com${ruta}`, {
  headers: { ...headers(), ...(etag ? { 'If-None-Match': etag } : {}) },
});

// Números de issue que un PR dice cerrar ("closes #12", "fixes #3", "resuelve #7"…).
const issuesDelPr = (pr) => [...`${pr.title}\n${pr.body ?? ''}`
  .matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|cierra|arregla|resuelve)\s*:?\s*#(\d+)/gi)]
  .map((m) => Number(m[1]));

export async function sincronizarIssues(guild, p) {
  const repo = parseRepo(p.github);
  if (!repo) return;
  const base = `/repos/${repo.owner}/${repo.repo}`;
  const res = await api(`${base}/issues?state=all&per_page=100&sort=created&direction=asc`, p.issuesEtag);
  const resPrs = await api(`${base}/pulls?state=open&per_page=100`, p.prsEtag);
  if (res.status === 304 && resPrs.status === 304) return;
  if (!res.ok && res.status !== 304) {
    const sinCupo = res.headers.get('x-ratelimit-remaining') === '0';
    const conToken = Boolean(process.env.GITHUB_PAT);
    let error = `GitHub respondió ${res.status}.`;
    if (sinCupo) error = conToken ? 'Se agotó el límite de consultas de GitHub; se reintentará solo.' : 'GitHub limitó las consultas sin token; se reintentará solo. Un GITHUB_PAT lo evita.';
    else if (res.status === 401) error = 'El GITHUB_PAT es inválido o venció: genera uno nuevo.';
    else if (res.status === 404 || res.status === 403) {
      error = conToken
        ? `El GITHUB_PAT no tiene acceso a ${repo.owner}/${repo.repo}: dale acceso a ese repo (o "All repositories") con permiso Issues: Read.`
        : 'No se pudo leer el repo (¿es privado? se necesita GITHUB_PAT).';
    }
    if (p.errorIssues !== error) {
      p.errorIssues = error;
      save();
      await refrescarTablero(guild, p, 'github');
      await refrescarTarjetaDeProyecto(guild, p.id);
    }
    return;
  }
  p.errorIssues = null;
  p.tareas ??= [];

  if (res.ok) {
    // Todas las páginas (la primera ya está pedida).
    let issues = await res.json();
    for (let pagina = 2; issues.length === (pagina - 1) * 100; pagina += 1) {
      const sig = await api(`${base}/issues?state=all&per_page=100&sort=created&direction=asc&page=${pagina}`);
      if (!sig.ok) break;
      issues = issues.concat(await sig.json());
    }
    p.issuesEtag = res.headers.get('etag');
    issues = issues.filter((i) => !i.pull_request);
    const vistos = new Set(issues.map((i) => `gh-${i.number}`));
    // Issues borrados o transferidos en GitHub desaparecen del tablero.
    p.tareas = p.tareas.filter((t) => t.origen !== 'github' || vistos.has(t.id));
    for (const issue of issues) {
      const id = `gh-${issue.number}`;
      const datos = {
        titulo: issue.title,
        url: issue.html_url,
        estado: issue.state === 'closed' ? 'hecha' : 'abierta',
        asignados: (issue.assignees ?? []).map((u) => u.login),
        cerradaEn: issue.closed_at,
      };
      const t = p.tareas.find((x) => x.id === id);
      if (t) Object.assign(t, datos);
      else p.tareas.push({ id, origen: 'github', numero: issue.number, fecha: issue.created_at, ...datos });
    }
  }

  if (resPrs.ok) {
    p.prsEtag = resPrs.headers.get('etag');
    p.prs = (await resPrs.json()).filter((pr) => !pr.draft).map((pr) => ({
      numero: pr.number,
      titulo: pr.title,
      url: pr.html_url,
      autor: pr.user?.login,
      revisores: (pr.requested_reviewers ?? []).map((u) => u.login),
      issues: issuesDelPr(pr),
    }));
  }

  save();
  await refrescarTablero(guild, p, 'github');
  await refrescarTablero(guild, p, 'extra');
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
    t.hechaEn = hecha ? new Date().toISOString() : null;
  }
  save();
  if (cambiadas.length) {
    await refrescarTablero(guild, p, 'extra');
    await refrescarTarjetaDeProyecto(guild, p.id);
  }
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
  await refrescarTarjetaDeProyecto(guild, p.id);
  return t;
}

export const proyectoPorCanalExtra = (channelId) => Object.values(getDb().proyectos).find((p) => p.extraId === channelId);

// Al cambiar de repo: olvida los issues y la caché del repo anterior.
export function reiniciarIssues(p) {
  p.tareas = (p.tareas ?? []).filter((t) => t.origen !== 'github');
  p.issuesEtag = null;
  p.prsEtag = null;
  p.prs = [];
  p.errorIssues = null;
}
