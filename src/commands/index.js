import {
  SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags,
} from 'discord.js';
import {
  getDb, slug, addProyecto, findProyecto, findProyectoByChannel, addIdea, save,
} from '../store.js';
import { isDriveLink, driveTipo } from '../drive.js';
import {
  LAYOUT, CAT_PROYECTOS, CAT_ARCHIVADOS, findText, ensureCategory,
} from '../layout.js';

const ESTADOS = ['💭 Idea', '📝 Planeación', '🚧 En progreso', '⏸️ Pausado', '✅ Terminado'];
const COLOR = 0x5865f2;
const ephemeral = { flags: MessageFlags.Ephemeral };

// Errores esperados que se muestran al usuario sin ensuciar la consola.
class UserError extends Error {}

const proyectoOption = (o, required = true) =>
  o.setName('proyecto').setDescription('Nombre del proyecto').setRequired(required).setAutocomplete(true);

export const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Crea las categorías y canales base del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('proyecto')
    .setDescription('Gestiona proyectos')
    .addSubcommand((s) => s.setName('crear').setDescription('Crea un proyecto con su propio canal')
      .addStringOption((o) => o.setName('nombre').setDescription('Nombre del proyecto').setRequired(true).setMaxLength(80))
      .addStringOption((o) => o.setName('descripcion').setDescription('De qué trata').setRequired(true).setMaxLength(1000))
      .addStringOption((o) => o.setName('drive').setDescription('Link de la carpeta de Google Drive del proyecto')))
    .addSubcommand((s) => s.setName('lista').setDescription('Lista todos los proyectos'))
    .addSubcommand((s) => s.setName('info').setDescription('Muestra la ficha de un proyecto')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('estado').setDescription('Cambia el estado de un proyecto')
      .addStringOption((o) => proyectoOption(o))
      .addStringOption((o) => o.setName('estado').setDescription('Nuevo estado').setRequired(true)
        .addChoices(...ESTADOS.map((e) => ({ name: e, value: e })))))
    .addSubcommand((s) => s.setName('archivar').setDescription('Mueve el canal del proyecto a ARCHIVADOS')
      .addStringOption((o) => proyectoOption(o))),

  new SlashCommandBuilder()
    .setName('drive')
    .setDescription('Links de Google Drive')
    .addSubcommand((s) => s.setName('agregar').setDescription('Guarda un link de Drive')
      .addStringOption((o) => o.setName('url').setDescription('Link de Google Drive/Docs').setRequired(true))
      .addStringOption((o) => o.setName('titulo').setDescription('Nombre descriptivo'))
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('lista').setDescription('Lista los links guardados')
      .addStringOption((o) => proyectoOption(o, false))),

  new SlashCommandBuilder()
    .setName('idea')
    .setDescription('Ideas')
    .addSubcommand((s) => s.setName('nueva').setDescription('Publica una idea para discutir y votar')
      .addStringOption((o) => o.setName('titulo').setDescription('Título corto').setRequired(true).setMaxLength(90))
      .addStringOption((o) => o.setName('descripcion').setDescription('Detalles').setMaxLength(1500)))
    .addSubcommand((s) => s.setName('lista').setDescription('Lista las ideas'))
    .addSubcommand((s) => s.setName('aprobar').setDescription('Convierte una idea en proyecto')
      .addIntegerOption((o) => o.setName('id').setDescription('Número de la idea').setRequired(true))),

  new SlashCommandBuilder().setName('ayuda').setDescription('Muestra cómo usar el bot'),
];

// ---------- helpers ----------

function proyectoEmbed(p) {
  const links = getDb().links.filter((l) => l.proyecto === p.id);
  const archivos = getDb().archivos.filter((a) => a.proyecto === p.id);
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`📁 ${p.nombre}`)
    .setDescription(p.descripcion)
    .addFields(
      { name: 'Estado', value: p.estado, inline: true },
      { name: 'Canal', value: `<#${p.channelId}>`, inline: true },
      { name: 'Creado por', value: `<@${p.autor}>`, inline: true },
      { name: 'Carpeta Drive', value: p.drive ?? '—' },
      {
        name: `Links (${links.length})`,
        value: links.slice(-8).map((l) => `${driveTipo(l.url)} [${l.titulo}](${l.url})`).join('\n') || '—',
      },
      { name: 'Archivos subidos', value: String(archivos.length), inline: true },
    )
    .setFooter({ text: `id: ${p.id}` })
    .setTimestamp(new Date(p.fecha));
}

async function crearProyecto(interaction, { nombre, descripcion, drive }) {
  const { guild } = interaction;
  const id = slug(nombre);
  if (!id) throw new UserError('Nombre inválido.');
  if (getDb().proyectos[id]) throw new UserError(`Ya existe el proyecto **${nombre}**.`);
  if (drive && !isDriveLink(drive)) throw new UserError('El link de Drive no es válido (debe ser drive.google.com o docs.google.com).');

  const cat = await ensureCategory(guild, CAT_PROYECTOS);
  const channel = await guild.channels.create({
    name: id, type: ChannelType.GuildText, parent: cat.id,
    topic: `${descripcion.slice(0, 900)}${drive ? ` | Drive: ${drive}` : ''}`,
  });
  const p = addProyecto({
    id, nombre, descripcion, drive: drive ?? null, estado: ESTADOS[1],
    channelId: channel.id, autor: interaction.user.id, fecha: new Date().toISOString(),
  });
  const ficha = await channel.send({ embeds: [proyectoEmbed(p)] });
  await ficha.pin().catch(() => {});
  p.fichaId = ficha.id;
  save();
  return p;
}

async function refrescarFicha(guild, p) {
  const channel = guild.channels.cache.get(p.channelId);
  if (!channel || !p.fichaId) return;
  const msg = await channel.messages.fetch(p.fichaId).catch(() => null);
  await msg?.edit({ embeds: [proyectoEmbed(p)] }).catch(() => {});
}

function resolverProyecto(interaction, required = true) {
  const nombre = interaction.options.getString('proyecto');
  const p = nombre ? findProyecto(nombre) : findProyectoByChannel(interaction.channelId);
  if (!p && (required || nombre)) {
    throw new UserError(nombre ? `No encontré el proyecto **${nombre}**.` : 'Indica el proyecto o usa el comando dentro de su canal.');
  }
  return p;
}

export async function registrarLink(guild, { url, titulo, proyecto, autor, origen }) {
  const saved = addLink({ url, titulo, proyecto: proyecto ?? null, autor });
  if (!saved) return false;
  const log = findText(guild, 'links-drive');
  const p = proyecto ? getDb().proyectos[proyecto] : null;
  await log?.send({
    embeds: [new EmbedBuilder().setColor(0x0f9d58)
      .setTitle(`${driveTipo(url)} · ${titulo}`.slice(0, 256)).setURL(url)
      .setDescription([
        p ? `Proyecto: **${p.nombre}** (<#${p.channelId}>)` : 'Sin proyecto',
        `Agregado por <@${autor}>`, origen ? `Origen: ${origen}` : null,
      ].filter(Boolean).join('\n'))
      .setTimestamp()],
  });
  if (p) await refrescarFicha(guild, p);
  return true;
}

// ---------- handlers ----------

const handlers = {
  async setup(interaction) {
    await interaction.deferReply(ephemeral);
    const { guild } = interaction;
    const creados = [];
    for (const { categoria, canales } of LAYOUT) {
      const cat = await ensureCategory(guild, categoria);
      for (const c of canales) {
        if (findText(guild, c.nombre)) continue;
        await guild.channels.create({ name: c.nombre, type: ChannelType.GuildText, parent: cat.id, topic: c.tema });
        creados.push(`#${c.nombre}`);
      }
    }
    const bienvenida = findText(guild, 'bienvenida');
    if (creados.includes('#bienvenida')) await bienvenida.send({ embeds: [ayudaEmbed()] });
    await interaction.editReply(creados.length
      ? `✅ Servidor organizado. Canales creados: ${creados.join(', ')}`
      : '✅ La estructura ya existía, no hubo cambios.');
  },

  async proyecto(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'crear') {
      await interaction.deferReply();
      const p = await crearProyecto(interaction, {
        nombre: interaction.options.getString('nombre'),
        descripcion: interaction.options.getString('descripcion'),
        drive: interaction.options.getString('drive') ?? undefined,
      });
      if (p.drive) {
        await registrarLink(interaction.guild, { url: p.drive, titulo: `Carpeta de ${p.nombre}`, proyecto: p.id, autor: interaction.user.id })
          .catch(() => {});
      }
      return interaction.editReply(`✅ Proyecto **${p.nombre}** creado en <#${p.channelId}>`);
    }

    if (sub === 'lista') {
      const ps = Object.values(db.proyectos);
      if (!ps.length) return interaction.reply('No hay proyectos aún. Crea uno con `/proyecto crear`.');
      const lineas = ps.map((p) => `${p.estado} — **${p.nombre}** <#${p.channelId}>${p.drive ? ` · [Drive](${p.drive})` : ''}`);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`📁 Proyectos (${ps.length})`).setDescription(lineas.join('\n').slice(0, 4000))],
      });
    }

    if (sub === 'info') {
      const p = resolverProyecto(interaction);
      return interaction.reply({ embeds: [proyectoEmbed(p)] });
    }

    if (sub === 'estado') {
      const p = resolverProyecto(interaction);
      p.estado = interaction.options.getString('estado');
      save();
      await refrescarFicha(interaction.guild, p);
      return interaction.reply(`🔄 **${p.nombre}** ahora está en: ${p.estado}`);
    }

    if (sub === 'archivar') {
      const p = resolverProyecto(interaction);
      const cat = await ensureCategory(interaction.guild, CAT_ARCHIVADOS);
      await interaction.guild.channels.cache.get(p.channelId)?.setParent(cat.id, { lockPermissions: false });
      p.archivado = true;
      save();
      return interaction.reply(`🗄️ **${p.nombre}** archivado.`);
    }
  },

  async drive(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'agregar') {
      const url = interaction.options.getString('url').trim();
      if (!isDriveLink(url)) throw new UserError('Ese link no es de Google Drive/Docs.');
      const p = resolverProyecto(interaction, false);
      const titulo = interaction.options.getString('titulo') ?? driveTipo(url).slice(2).trim();
      const ok = await registrarLink(interaction.guild, { url, titulo, proyecto: p?.id, autor: interaction.user.id });
      return interaction.reply(ok
        ? `✅ Link guardado${p ? ` en **${p.nombre}**` : ''}: ${driveTipo(url)} [${titulo}](<${url}>)`
        : { content: 'Ese link ya estaba guardado.', ...ephemeral });
    }

    if (sub === 'lista') {
      const p = resolverProyecto(interaction, false);
      const links = getDb().links.filter((l) => !p || l.proyecto === p.id);
      if (!links.length) return interaction.reply({ content: 'No hay links guardados.', ...ephemeral });
      const lineas = links.slice(-30).map((l) => {
        const pr = l.proyecto ? getDb().proyectos[l.proyecto]?.nombre : null;
        return `${driveTipo(l.url)} [${l.titulo}](${l.url})${!p && pr ? ` — *${pr}*` : ''}`;
      });
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x0f9d58)
          .setTitle(`🔗 Links de Drive${p ? ` · ${p.nombre}` : ''} (${links.length})`)
          .setDescription(lineas.join('\n').slice(0, 4000))],
      });
    }
  },

  async idea(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'nueva') {
      const titulo = interaction.options.getString('titulo');
      const descripcion = interaction.options.getString('descripcion') ?? '';
      const canal = findText(interaction.guild, 'ideas') ?? interaction.channel;
      const id = addIdea({ titulo, descripcion, autor: interaction.user.id, estado: 'abierta' });
      const msg = await canal.send({
        embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle(`💡 #${id} · ${titulo}`)
          .setDescription(descripcion || '—').setFooter({ text: `Para convertirla en proyecto: /idea aprobar id:${id}` })
          .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })],
      });
      await msg.react('👍');
      await msg.react('👎');
      await msg.startThread({ name: `💬 ${titulo}`.slice(0, 100) }).catch(() => {});
      const idea = db.ideas.find((i) => i.id === id);
      idea.messageId = msg.id;
      idea.channelId = canal.id;
      save();
      return interaction.reply({ content: `💡 Idea #${id} publicada en <#${canal.id}>`, ...ephemeral });
    }

    if (sub === 'lista') {
      if (!db.ideas.length) return interaction.reply('No hay ideas aún. Usa `/idea nueva`.');
      const lineas = db.ideas.slice(-30).map((i) => `${i.estado === 'aprobada' ? '✅' : '💡'} **#${i.id}** ${i.titulo}`);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('💡 Ideas').setDescription(lineas.join('\n'))] });
    }

    if (sub === 'aprobar') {
      const idea = db.ideas.find((i) => i.id === interaction.options.getInteger('id'));
      if (!idea) throw new UserError('No existe esa idea.');
      if (idea.estado === 'aprobada') throw new UserError('Esa idea ya es un proyecto.');
      await interaction.deferReply();
      const p = await crearProyecto(interaction, { nombre: idea.titulo, descripcion: idea.descripcion || idea.titulo });
      idea.estado = 'aprobada';
      idea.proyecto = p.id;
      save();
      await findText(interaction.guild, 'ideas-aprobadas')
        ?.send(`✅ La idea **#${idea.id} ${idea.titulo}** ahora es el proyecto <#${p.channelId}>`);
      return interaction.editReply(`✅ Idea #${idea.id} convertida en proyecto: <#${p.channelId}>`);
    }
  },

  async ayuda(interaction) {
    return interaction.reply({ embeds: [ayudaEmbed()], ...ephemeral });
  },
};

function ayudaEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle('🤖 Cómo funciona este servidor').setDescription([
    '**Proyectos**',
    '`/proyecto crear` — crea un canal para el proyecto con su ficha fijada',
    '`/proyecto lista` · `/proyecto info` · `/proyecto estado` · `/proyecto archivar`',
    '',
    '**Google Drive**',
    '`/drive agregar` — guarda un link (carpeta, doc, hoja, presentación)',
    '`/drive lista` — ver links (de un proyecto o todos)',
    'Además, cualquier link de Drive que pegues en un canal se registra solo en #links-drive 📎',
    '',
    '**Ideas**',
    '`/idea nueva` — publica en #ideas con votación e hilo de discusión',
    '`/idea lista` · `/idea aprobar` — convierte una idea en proyecto',
    '',
    '**Archivos**: lo que subas en el canal de un proyecto queda registrado en #archivos.',
  ].join('\n'));
}

export async function handleCommand(interaction) {
  const handler = handlers[interaction.commandName];
  if (!handler) return;
  try {
    await handler(interaction);
  } catch (err) {
    const content = err instanceof UserError ? `⚠️ ${err.message}` : '⚠️ Ocurrió un error inesperado.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => {});
    else await interaction.reply({ content, ...ephemeral }).catch(() => {});
    if (!(err instanceof UserError)) console.error(err);
  }
}

export async function handleAutocomplete(interaction) {
  const q = slug(interaction.options.getFocused() ?? '');
  const opciones = Object.values(getDb().proyectos)
    .filter((p) => p.id.includes(q))
    .slice(0, 25)
    .map((p) => ({ name: p.nombre.slice(0, 100), value: p.nombre.slice(0, 100) }));
  await interaction.respond(opciones).catch(() => {});
}
