// Proyectos: formulario de creación, rol privado, categoría con chat, archivos y voz.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, LabelBuilder,
  ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder,
} from 'discord.js';
import {
  getDb, slug, addProyecto, save, githubDe,
} from './store.js';
import { driveTipo } from './drive.js';
import { crearForo, ensureCarpeta, refrescarIndice } from './carpetas.js';
import { conectarGithub, verificarConexion } from './github.js';
import { ensureCanalesTareas, sincronizarIssues, refrescarTablero } from './tareas.js';
import { publicarTarjeta, refrescarTarjetaDeProyecto, avance } from './tarjetas.js';
import {
  githubConfigurado, crearRepo, invitar, quitarAcceso,
} from './githubApi.js';
import { COLORES, PROYECTO } from './layout.js';
import { prepararEnSegundoPlano, guiaSkillsEmbed } from './plantillaRepo.js';

// Errores esperados que se muestran al usuario sin ensuciar la consola.
export class UserError extends Error {}

// ---------- formularios ----------

const texto = (id, label, { style = TextInputStyle.Short, required = false, max, placeholder, value } = {}) => {
  const input = new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(required);
  if (max) input.setMaxLength(max);
  if (placeholder) input.setPlaceholder(placeholder);
  if (value) input.setValue(value);
  return new LabelBuilder().setLabel(label).setTextInputComponent(input);
};

const selectorMiembros = (defaults = []) => new LabelBuilder()
  .setLabel('Miembros del proyecto')
  .setDescription('Solo ellos verán los canales, archivos y voz del proyecto')
  .setUserSelectMenuComponent(new UserSelectMenuBuilder()
    .setCustomId('miembros').setMinValues(0).setMaxValues(25).setRequired(false)
    .setPlaceholder('Elige a las personas')
    .setDefaultUsers(defaults.slice(0, 25)));

export function modalCrear({ ideaId, nombre, descripcion, autorId } = {}) {
  return new ModalBuilder()
    .setCustomId(ideaId ? `proyecto-crear:${ideaId}` : 'proyecto-crear')
    .setTitle('Nuevo proyecto')
    .addLabelComponents(
      texto('nombre', 'Nombre del proyecto', { required: true, max: 80, value: nombre }),
      texto('descripcion', 'Descripción', { style: TextInputStyle.Paragraph, required: true, max: 1000, value: descripcion }),
      texto('github', 'Repositorio de GitHub', {
        placeholder: githubConfigurado() ? 'Vacío = el bot crea el repo' : 'https://github.com/usuario/repo',
      }),
      texto('drive', 'Carpeta de Google Drive', { placeholder: 'https://drive.google.com/drive/folders/...' }),
      selectorMiembros(autorId ? [autorId] : []),
    );
}

export const modalMiembros = (p) => new ModalBuilder()
  .setCustomId(`proyecto-miembros:${p.id}`)
  .setTitle(`Miembros · ${p.nombre}`.slice(0, 45))
  .addLabelComponents(selectorMiembros(p.miembros));

export const modalEditar = (p) => new ModalBuilder()
  .setCustomId(`proyecto-editar:${p.id}`)
  .setTitle(`Editar · ${p.nombre}`.slice(0, 45))
  .addLabelComponents(
    texto('descripcion', 'Descripción', { style: TextInputStyle.Paragraph, required: true, max: 1000, value: p.descripcion }),
    texto('github', 'Repositorio de GitHub', { placeholder: 'https://github.com/usuario/repo', value: p.github }),
    texto('drive', 'Carpeta de Google Drive', { placeholder: 'https://drive.google.com/drive/folders/...', value: p.drive }),
  );

// ---------- ficha ----------

export function proyectoEmbed(p) {
  const db = getDb();
  const links = db.links.filter((l) => l.proyecto === p.id);
  const archivos = db.archivos.filter((a) => a.proyecto === p.id);
  return new EmbedBuilder()
    .setColor(COLORES.primario)
    .setTitle(`◆ ${p.nombre}`)
    .setDescription(p.descripcion)
    .addFields(
      { name: 'Estado', value: avance(p).etapa, inline: true },
      { name: 'Rol', value: `<@&${p.roleId}>`, inline: true },
      { name: '🐙 GitHub', value: p.github ?? (p.errorRepo ? `⚠️ ${p.errorRepo}` : '—'), inline: true },
      { name: '⭐ Responsable', value: `<@${p.autor}>`, inline: true },
      { name: '☁️ Carpeta Drive', value: p.drive ? `[abrir](${p.drive})` : '—', inline: true },
      { name: '📂 Archivos', value: `<#${p.foroId}> (${archivos.length})`, inline: true },
      {
        name: '📋 Tareas',
        value: p.tareasId
          ? `<#${p.tareasId}> · <#${p.extraId}> (${(p.tareas ?? []).filter((t) => t.estado === 'hecha').length}/${(p.tareas ?? []).length})`
          : '—',
        inline: true,
      },
      {
        name: '📡 Commits',
        value: p.commitsId ? `<#${p.commitsId}> ${p.githubConectado ? '✅ conectado' : '⚠️ falta conectar GitHub'}` : '—',
        inline: true,
      },
      { name: `👥 Miembros (${p.miembros.length})`, value: p.miembros.map((m) => `<@${m}>`).join(' ') || '—' },
      {
        name: `🔗 Links de Drive (${links.length})`,
        value: links.slice(-8).map((l) => `${driveTipo(l.url)} [${l.titulo}](${l.url})`).join('\n') || '—',
      },
    )
    .setFooter({ text: `id: ${p.id}` })
    .setTimestamp(new Date(p.fecha));
}

export function fichaComponents(p) {
  // Fila 1: acciones del responsable. Fila 2: conexiones y enlaces (máx. 5 botones por fila).
  const acciones = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`proyecto-miembros:${p.id}`).setLabel('Miembros').setEmoji('👥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`proyecto-editar:${p.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    p.pausado
      ? new ButtonBuilder().setCustomId(`proyecto-pausa:${p.id}`).setLabel('Reanudar').setEmoji('▶️').setStyle(ButtonStyle.Success)
      : new ButtonBuilder().setCustomId(`proyecto-pausa:${p.id}`).setLabel('Pausar').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`proyecto-actualizar:${p.id}`).setLabel('Actualizar').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`proyecto-eliminar:${p.id}`).setLabel('Eliminar').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );
  const enlaces = new ActionRowBuilder();
  if (!p.githubConectado) {
    enlaces.addComponents(new ButtonBuilder().setCustomId(`proyecto-github:${p.id}`).setLabel('Conectar GitHub').setEmoji('📡').setStyle(ButtonStyle.Secondary));
  }
  if (p.github) enlaces.addComponents(new ButtonBuilder().setURL(p.github).setLabel('GitHub').setEmoji('🐙').setStyle(ButtonStyle.Link));
  if (p.drive) enlaces.addComponents(new ButtonBuilder().setURL(p.drive).setLabel('Drive').setEmoji('☁️').setStyle(ButtonStyle.Link));
  return enlaces.components.length ? [acciones, enlaces] : [acciones];
}

export const modalEliminar = (p) => new ModalBuilder()
  .setCustomId(`proyecto-eliminar:${p.id}`)
  .setTitle(`Eliminar · ${p.nombre}`.slice(0, 45))
  .addLabelComponents(new LabelBuilder()
    .setLabel('Escribe el nombre del proyecto para confirmar')
    .setDescription('Borra canales, rol, tareas y su publicación en aprobados. El repo de GitHub se conserva.')
    .setTextInputComponent(new TextInputBuilder().setCustomId('confirmacion').setStyle(TextInputStyle.Short)
      .setRequired(true).setPlaceholder(p.nombre.slice(0, 100))));

export async function refrescarFicha(guild, p) {
  const channel = await guild.channels.fetch(p.channelId).catch(() => null);
  if (!channel || !p.fichaId) return;
  const msg = await channel.messages.fetch(p.fichaId).catch(() => null);
  await msg?.edit({ embeds: [proyectoEmbed(p)], components: fichaComponents(p) }).catch(() => {});
}

// ---------- creación ----------

const VER = PermissionFlagsBits.ViewChannel;
const MIEMBRO = [VER, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak,
  PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.CreatePublicThreads];

// opciones.idea: idea de origen (para la tarjeta); opciones.tarjeta = false para no publicarla aquí.
export async function crearProyecto(guild, autorId, { nombre, descripcion, github, drive, miembros = [] }, opciones = {}) {
  const id = slug(nombre);
  if (!id) throw new UserError('Nombre inválido.');
  if (getDb().proyectos[id]) throw new UserError(`Ya existe el proyecto **${nombre}**.`);
  const todos = [...new Set([autorId, ...miembros])];

  // Sin repo indicado, el bot crea uno nuevo en GitHub (si hay GITHUB_PAT).
  let errorRepo = null;
  let repoNuevo = false;
  if (!github && githubConfigurado()) {
    try {
      const creado = await crearRepo(id, descripcion);
      github = creado.url;
      repoNuevo = creado.creado;
    } catch (err) {
      errorRepo = err.message;
    }
  }

  const role = await guild.roles.create({ name: PROYECTO.rol(nombre).slice(0, 100), mentionable: true, reason: `Proyecto ${nombre}` });
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [VER] },
    { id: role.id, allow: MIEMBRO },
    { id: guild.members.me.id, allow: [VER, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageThreads] },
  ];
  const cat = await guild.channels.create({ name: PROYECTO.categoria(nombre).slice(0, 100), type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
  const chat = await guild.channels.create({
    name: PROYECTO.chat, type: ChannelType.GuildText, parent: cat.id, permissionOverwrites: overwrites,
    topic: `${descripcion.slice(0, 800)}${github ? ` | GitHub: ${github}` : ''}`,
  });
  const foro = await crearForo(guild, { name: PROYECTO.archivos, parent: cat.id, permissionOverwrites: overwrites });
  const voz = await guild.channels.create({ name: PROYECTO.voz, type: ChannelType.GuildVoice, parent: cat.id, permissionOverwrites: overwrites });

  const p = addProyecto({
    id, nombre, descripcion, github: github ?? null, drive: drive ?? null,
    roleId: role.id, categoryId: cat.id, channelId: chat.id, foroId: foro.id, vozId: voz.id,
    miembros: [], autor: autorId, fecha: new Date().toISOString(), errorRepo,
  });
  const equipo = await sincronizarMiembros(guild, p, todos);
  await ensureCarpeta(guild, p.id);
  const conexion = await conectarGithub(guild, p);
  await ensureCanalesTareas(guild, p);
  // Primera lectura de issues al momento (si el repo es nuevo, estará vacío).
  if (p.github) await sincronizarIssues(guild, p).catch((e) => console.error(`Issues de ${p.id}:`, e.message));

  const ficha = await chat.send({ embeds: [proyectoEmbed(p)], components: fichaComponents(p) });
  await ficha.pin().catch(() => {});
  p.fichaId = ficha.id;
  save();
  await chat.send({ content: `👋 Bienvenidos al proyecto ${p.miembros.map((m) => `<@${m}>`).join(' ')}` });
  await avisarGithub(guild, p, equipo);
  // Repo creado por el bot: se le agregan las skills y el git workflow. Repo existente: solo la guía.
  if (repoNuevo) prepararEnSegundoPlano(guild, p);
  else await chat.send({ embeds: [guiaSkillsEmbed(p, null)] }).catch(() => {});
  if (opciones.tarjeta !== false) await publicarTarjeta(guild, { p, idea: opciones.idea });
  return { p, github: conexion, equipo };
}

// Deja el rol exactamente en las personas indicadas (ids de usuarios, sin bots)
// e invita o quita a cada persona del repo de GitHub según su cuenta vinculada.
export async function sincronizarMiembros(guild, p, nuevos) {
  const agregar = nuevos.filter((m) => !p.miembros.includes(m));
  const quitar = p.miembros.filter((m) => !nuevos.includes(m));
  const invitados = [];
  const sinGithub = [];
  for (const userId of agregar) {
    const member = await guild.members.fetch(userId).catch(() => null);
    await member?.roles.add(p.roleId);
    const login = githubDe(userId);
    if (!login) sinGithub.push(userId);
    else if (p.github && (await invitar(p.github, login).catch(() => ({ ok: false }))).ok) invitados.push(userId);
  }
  for (const userId of quitar) {
    const member = await guild.members.fetch(userId).catch(() => null);
    await member?.roles.remove(p.roleId).catch(() => {});
    const login = githubDe(userId);
    if (login && p.github) await quitarAcceso(p.github, login).catch(() => {});
  }
  p.miembros = [...nuevos];
  save();
  return {
    agregar, quitar, invitados, sinGithub,
  };
}

// Mensaje en el chat del proyecto sobre las invitaciones a GitHub.
export async function avisarGithub(guild, p, { invitados = [], sinGithub = [] } = {}) {
  if (!p.github || (!invitados.length && !sinGithub.length)) return;
  const chat = await guild.channels.fetch(p.channelId).catch(() => null);
  const lineas = [];
  if (invitados.length) lineas.push(`📨 Invitación al repo de GitHub enviada a ${invitados.map((m) => `<@${m}>`).join(' ')} (revisen su correo o github.com/notifications).`);
  if (sinGithub.length) lineas.push(`🔗 ${sinGithub.map((m) => `<@${m}>`).join(' ')}: vinculen su GitHub con \`/github vincular\` y el bot les enviará la invitación.`);
  await chat?.send(lineas.join('\n')).catch(() => {});
}

// Al vincular una cuenta, invita a esa persona a los repos de todos sus proyectos.
export async function invitarAProyectos(guild, userId) {
  const login = githubDe(userId);
  const invitado = [];
  for (const p of Object.values(getDb().proyectos)) {
    if (!p.github || p.archivado || !p.miembros.includes(userId)) continue;
    if ((await invitar(p.github, login).catch(() => ({ ok: false }))).ok) {
      invitado.push(p);
      await avisarGithub(guild, p, { invitados: [userId] });
    }
  }
  return invitado;
}

// Usuarios elegidos en el selector del formulario, sin bots.
export const miembrosElegidos = (fields) =>
  [...(fields.getSelectedUsers('miembros')?.values() ?? [])].filter((u) => !u.bot).map((u) => u.id);

// Solo quien creó el proyecto y los administradores pueden cambiar sus datos.
// Los miembros únicamente ven los canales y escriben.
export function puedeGestionar(interaction, p) {
  return p.autor === interaction.user.id
    || interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles);
}

export async function archivarProyecto(guild, p) {
  const cat = await guild.channels.fetch(p.categoryId).catch(() => null);
  if (cat && cat.name !== PROYECTO.archivada(p.nombre)) {
    await cat.setName(PROYECTO.archivada(p.nombre).slice(0, 100));
    await cat.setPosition(guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size);
  }
  p.archivado = true;
  save();
  await refrescarFicha(guild, p);
  await refrescarTarjetaDeProyecto(guild, p.id);
}

// El estado es automático (según issues); solo Pausado se marca a mano.
export async function alternarPausa(guild, p) {
  p.pausado = !p.pausado;
  save();
  await refrescarFicha(guild, p);
  await refrescarTarjetaDeProyecto(guild, p.id);
  return p.pausado;
}

// Elimina el proyecto de Discord y del bot. El repo de GitHub se conserva (solo se quita el webhook del bot).
export async function eliminarProyecto(guild, p) {
  const db = getDb();
  const borrados = [];

  // Publicación en proyectos aprobados (y la de la idea si quedó separada).
  const idea = db.ideas.find((i) => i.proyecto === p.id);
  for (const hiloId of [p.tarjetaId, idea?.tarjetaId].filter(Boolean)) {
    const hilo = await guild.channels.fetch(hiloId).catch(() => null);
    if (hilo) { await hilo.delete(`Proyecto ${p.nombre} eliminado`).catch(() => {}); borrados.push('publicación en aprobados'); }
  }

  // Webhook de commits registrado en el repo.
  if (p.githubHookId && githubConfigurado()) {
    const repo = p.github?.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
    if (repo) {
      await fetch(`https://api.github.com/repos/${repo[1]}/${repo[2]}/hooks/${p.githubHookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.GITHUB_PAT}`, Accept: 'application/vnd.github+json', 'User-Agent': 'discord-organizador' },
      }).catch(() => {});
    }
  }

  // Canales (los de la categoría y los guardados) y la categoría al final.
  const ids = new Set([p.channelId, p.foroId, p.vozId, p.commitsId, p.tareasId, p.extraId].filter(Boolean));
  await guild.channels.fetch().catch(() => {});
  for (const c of guild.channels.cache.filter((x) => x.parentId === p.categoryId).values()) ids.add(c.id);
  let canales = 0;
  for (const id of ids) {
    const c = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
    if (c && await c.delete(`Proyecto ${p.nombre} eliminado`).then(() => true).catch(() => false)) canales += 1;
  }
  const cat = await guild.channels.fetch(p.categoryId).catch(() => null);
  if (cat) await cat.delete(`Proyecto ${p.nombre} eliminado`).catch(() => {});
  borrados.push(`${canales} canal(es) y la categoría`);

  const rol = await guild.roles.fetch(p.roleId).catch(() => null);
  if (rol) { await rol.delete(`Proyecto ${p.nombre} eliminado`).catch(() => {}); borrados.push('el rol'); }

  // Registro en el bot.
  if (idea) { idea.proyecto = null; idea.estado = 'eliminada'; delete idea.tarjetaId; }
  db.archivos = db.archivos.filter((a) => a.proyecto !== p.id);
  db.links = db.links.filter((l) => l.proyecto !== p.id);
  delete db.carpetas[p.id];
  delete db.proyectos[p.id];
  save();
  return borrados;
}

// Revisa y refresca todo el proyecto: conexión con GitHub, issues, tableros, carpeta, ficha y publicación en aprobados.
export async function actualizarProyecto(guild, p) {
  const resumen = [];
  const conexion = await verificarConexion(guild, p).catch((e) => ({ conectado: false, detalle: e.message }));
  resumen.push(`${conexion.conectado ? '✅' : '⚠️'} **GitHub:** ${conexion.detalle}`);

  await ensureCanalesTareas(guild, p).catch(() => {});
  if (p.github) {
    p.issuesEtag = null;
    p.prsEtag = null;
    await sincronizarIssues(guild, p).catch((e) => { p.errorIssues = e.message; });
    const issues = (p.tareas ?? []).filter((t) => t.origen === 'github');
    resumen.push(p.errorIssues ? `⚠️ **Issues:** ${p.errorIssues}`
      : `✅ **Issues:** ${issues.length} (${issues.filter((t) => t.estado !== 'hecha').length} abiertos) · ${(p.prs ?? []).length} PR en revisión`);
  }
  await refrescarTablero(guild, p, 'extra').catch(() => {});
  await refrescarIndice(guild, p.id).catch(() => {});
  await refrescarFicha(guild, p);
  await refrescarTarjetaDeProyecto(guild, p.id).catch(() => {});
  resumen.push(`✅ **Refrescado:** ficha, tableros de tareas, carpeta de archivos y publicación en aprobados (estado: ${avance(p).etapa})`);
  return resumen;
}
