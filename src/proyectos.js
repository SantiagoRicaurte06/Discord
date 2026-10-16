// Proyectos: formulario de creación, rol privado, categoría con chat, archivos y voz.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, LabelBuilder,
  ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder,
} from 'discord.js';
import {
  getDb, slug, addProyecto, save, githubDe,
} from './store.js';
import { driveTipo } from './drive.js';
import { crearForo, ensureCarpeta } from './carpetas.js';
import { conectarGithub } from './github.js';
import { ensureCanalesTareas } from './tareas.js';
import {
  githubConfigurado, crearRepo, invitar, quitarAcceso,
} from './githubApi.js';
import { COLORES, PROYECTO } from './layout.js';

export const ESTADOS = ['💭 Idea', '📝 Planeación', '🚧 En progreso', '⏸️ Pausado', '✅ Terminado'];

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
      { name: 'Estado', value: p.estado, inline: true },
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
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`proyecto-miembros:${p.id}`).setLabel('Miembros').setEmoji('👥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`proyecto-editar:${p.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
  );
  if (!p.githubConectado) {
    row.addComponents(new ButtonBuilder().setCustomId(`proyecto-github:${p.id}`).setLabel('Conectar GitHub').setEmoji('📡').setStyle(ButtonStyle.Secondary));
  }
  if (p.github) row.addComponents(new ButtonBuilder().setURL(p.github).setLabel('GitHub').setEmoji('🐙').setStyle(ButtonStyle.Link));
  if (p.drive) row.addComponents(new ButtonBuilder().setURL(p.drive).setLabel('Drive').setEmoji('☁️').setStyle(ButtonStyle.Link));
  return [row];
}

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

export async function crearProyecto(guild, autorId, { nombre, descripcion, github, drive, miembros = [] }) {
  const id = slug(nombre);
  if (!id) throw new UserError('Nombre inválido.');
  if (getDb().proyectos[id]) throw new UserError(`Ya existe el proyecto **${nombre}**.`);
  const todos = [...new Set([autorId, ...miembros])];

  // Sin repo indicado, el bot crea uno nuevo en GitHub (si hay GITHUB_PAT).
  let errorRepo = null;
  if (!github && githubConfigurado()) {
    try {
      github = (await crearRepo(id, descripcion)).url;
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
    id, nombre, descripcion, github: github ?? null, drive: drive ?? null, estado: ESTADOS[1],
    roleId: role.id, categoryId: cat.id, channelId: chat.id, foroId: foro.id, vozId: voz.id,
    miembros: [], autor: autorId, fecha: new Date().toISOString(), errorRepo,
  });
  const equipo = await sincronizarMiembros(guild, p, todos);
  await ensureCarpeta(guild, p.id);
  const conexion = await conectarGithub(guild, p);
  await ensureCanalesTareas(guild, p);

  const ficha = await chat.send({ embeds: [proyectoEmbed(p)], components: fichaComponents(p) });
  await ficha.pin().catch(() => {});
  p.fichaId = ficha.id;
  save();
  await chat.send({ content: `👋 Bienvenidos al proyecto ${p.miembros.map((m) => `<@${m}>`).join(' ')}` });
  await avisarGithub(guild, p, equipo);
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
  p.estado = ESTADOS[4];
  save();
  await refrescarFicha(guild, p);
}
