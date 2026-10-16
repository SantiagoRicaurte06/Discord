import {
  SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import {
  getDb, slug, findProyecto, findProyectoByChannel, addLink, addIdea, save,
} from '../store.js';
import { isDriveLink, driveTipo } from '../drive.js';
import {
  ensureForo, ensureCarpeta, guardarArchivo, asignarRespaldo, GENERAL,
} from '../carpetas.js';
import {
  LAYOUT, VOZ, findText, findCategory, ensureCategory,
} from '../layout.js';
import {
  ESTADOS, UserError, modalCrear, modalMiembros, modalEditar, proyectoEmbed, refrescarFicha,
  crearProyecto, sincronizarMiembros, miembrosElegidos, puedeGestionar, archivarProyecto,
} from '../proyectos.js';

const COLOR = 0x5865f2;
const AFK_SEGUNDOS = 900; // 15 minutos
const ROL_CREADOR = 'Creador de proyectos';
const CANAL_CREAR = 'crear-proyectos';
const ephemeral = { flags: MessageFlags.Ephemeral };

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
    .addSubcommand((s) => s.setName('crear').setDescription('Abre el formulario para crear un proyecto'))
    .addSubcommand((s) => s.setName('lista').setDescription('Lista los proyectos'))
    .addSubcommand((s) => s.setName('info').setDescription('Muestra la ficha de un proyecto')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('miembros').setDescription('Agrega o quita personas de un proyecto')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('estado').setDescription('Cambia el estado de un proyecto')
      .addStringOption((o) => o.setName('estado').setDescription('Nuevo estado').setRequired(true)
        .addChoices(...ESTADOS.map((e) => ({ name: e, value: e }))))
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('archivar').setDescription('Marca el proyecto como terminado y lo manda al final')
      .addStringOption((o) => proyectoOption(o, false))),

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
      .addStringOption((o) => o.setName('titulo').setDescription('Título corto').setRequired(true).setMaxLength(80))
      .addStringOption((o) => o.setName('descripcion').setDescription('Detalles').setMaxLength(1000)))
    .addSubcommand((s) => s.setName('lista').setDescription('Lista las ideas'))
    .addSubcommand((s) => s.setName('aprobar').setDescription('Convierte una idea en proyecto')
      .addIntegerOption((o) => o.setName('id').setDescription('Número de la idea').setRequired(true))),

  new SlashCommandBuilder()
    .setName('archivo')
    .setDescription('Archivos y sus respaldos en Drive')
    .addSubcommand((s) => s.setName('subir').setDescription('Guarda un archivo en una carpeta de archivos')
      .addAttachmentOption((o) => o.setName('archivo').setDescription('El archivo').setRequired(true))
      .addStringOption((o) => o.setName('drive').setDescription('Link de respaldo en Google Drive'))
      .addStringOption((o) => o.setName('descripcion').setDescription('Nota corta sobre el archivo').setMaxLength(200))
      .addStringOption((o) => proyectoOption(o, false).setDescription('Proyecto (vacío = carpeta General)')))
    .addSubcommand((s) => s.setName('respaldo').setDescription('Agrega o cambia el link de Drive de un archivo')
      .addStringOption((o) => o.setName('archivo').setDescription('Archivo').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('drive').setDescription('Link de respaldo en Google Drive').setRequired(true))),

  new SlashCommandBuilder().setName('ayuda').setDescription('Muestra cómo usar el bot'),
];

// ---------- helpers ----------

const esAdmin = (interaction) => interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles);

// Un proyecto es visible para sus miembros y para quien gestiona roles.
const visible = (interaction, proyectoId) => {
  if (!proyectoId) return true;
  const p = getDb().proyectos[proyectoId];
  return !p || esAdmin(interaction) || p.miembros.includes(interaction.user.id);
};

function resolverProyecto(interaction, required = true) {
  const nombre = interaction.options.getString('proyecto');
  const p = nombre ? findProyecto(nombre) : findProyectoByChannel(interaction.channelId);
  if ((!p && (required || nombre)) || (p && !visible(interaction, p.id))) {
    throw new UserError(nombre ? `No encontré el proyecto **${nombre}**.` : 'Indica el proyecto o usa el comando dentro de su canal.');
  }
  return p;
}

// Crear proyectos: solo el rol "Creador de proyectos" (y administradores).
function exigirCreador(interaction) {
  const tieneRol = interaction.member?.roles?.cache?.some((r) => r.name === ROL_CREADOR);
  if (!tieneRol && !esAdmin(interaction)) {
    throw new UserError(`Necesitas el rol **${ROL_CREADOR}** para crear proyectos.`);
  }
}

function proyectoGestionable(interaction, p) {
  if (!puedeGestionar(interaction, p)) throw new UserError('Solo los miembros del proyecto pueden hacer esto.');
  return p;
}

export async function registrarLink(guild, { url, titulo, proyecto, autor, origen }) {
  const saved = addLink({ url, titulo, proyecto: proyecto ?? null, autor });
  if (!saved) return false;
  const p = proyecto ? getDb().proyectos[proyecto] : null;
  // Los links de proyectos privados se anuncian en su propio chat, no en el canal público.
  const log = p ? await guild.channels.fetch(p.channelId).catch(() => null) : findText(guild, 'links-drive');
  await log?.send({
    embeds: [new EmbedBuilder().setColor(0x0f9d58)
      .setTitle(`${driveTipo(url)} · ${titulo}`.slice(0, 256)).setURL(url)
      .setDescription([
        p ? `Guardado en la ficha de **${p.nombre}**` : 'Sin proyecto',
        `Agregado por <@${autor}>`, origen ? `Origen: ${origen}` : null,
      ].filter(Boolean).join('\n'))
      .setTimestamp()],
    allowedMentions: { parse: [] },
  });
  if (p) await refrescarFicha(guild, p);
  return true;
}

// Canal de voz general + AFK a los 15 minutos.
async function setupVoz(guild) {
  const cat = findCategory(guild, VOZ) ?? findCategory(guild, 'Canales de voz');
  const categoria = cat ? await cat.setName(VOZ) : await ensureCategory(guild, VOZ);
  const voces = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice);

  let general = voces.find((c) => c.name === '🔊 General') ?? voces.find((c) => c.name === 'General' && !c.parent?.name.startsWith('📁'));
  if (general) {
    if (general.name !== '🔊 General' || general.parentId !== categoria.id) {
      await general.edit({ name: '🔊 General', parent: categoria.id });
    }
  } else {
    general = await guild.channels.create({ name: '🔊 General', type: ChannelType.GuildVoice, parent: categoria.id });
  }

  const afk = voces.find((c) => c.name === '💤 AFK') ?? await guild.channels.create({
    name: '💤 AFK', type: ChannelType.GuildVoice, parent: categoria.id,
    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Speak] }],
  });
  if (guild.afkChannelId !== afk.id) await guild.setAFKChannel(afk);
  if (guild.afkTimeout !== AFK_SEGUNDOS) await guild.setAFKTimeout(AFK_SEGUNDOS);
}

// #crear-proyectos: todos lo ven, solo el rol "Creador de proyectos" escribe. Tiene el panel con el botón.
async function setupCrearProyectos(guild) {
  const rol = guild.roles.cache.find((r) => r.name === ROL_CREADOR)
    ?? await guild.roles.create({ name: ROL_CREADOR, color: 0x57f287, mentionable: true, reason: 'Puede crear proyectos y escribir en #crear-proyectos' });
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.AddReactions] },
    { id: rol.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.AddReactions] },
  ];
  let canal = findText(guild, CANAL_CREAR);
  if (canal) {
    await canal.permissionOverwrites.set(overwrites);
  } else {
    const cat = await ensureCategory(guild, LAYOUT[0].categoria);
    canal = await guild.channels.create({
      name: CANAL_CREAR, type: ChannelType.GuildText, parent: cat.id, permissionOverwrites: overwrites,
      topic: `Crea proyectos con el botón o /proyecto crear. Solo el rol ${ROL_CREADOR} puede escribir aquí.`,
    });
  }

  const db = getDb();
  const panel = db.panelCrear && await canal.messages.fetch(db.panelCrear).catch(() => null);
  const contenido = {
    embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🚀 Crear un proyecto').setDescription([
      'Pulsa el botón para abrir el formulario:',
      '• Nombre y descripción',
      '• Repositorio de GitHub',
      '• Carpeta de Google Drive',
      '• Miembros del equipo',
      '',
      'Se creará un **rol** y una **categoría privada** con chat, carpeta de archivos y canal de voz.',
      `Solo <@&${rol.id}> puede crear proyectos y escribir en este canal.`,
    ].join('\n'))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('proyecto-panel').setLabel('Crear proyecto').setEmoji('➕').setStyle(ButtonStyle.Success),
    )],
    allowedMentions: { parse: [] },
  };
  if (panel) await panel.edit(contenido);
  else {
    const msg = await canal.send(contenido);
    await msg.pin().catch(() => {});
    db.panelCrear = msg.id;
    save();
  }
  return canal;
}

// Crea categorías y canales base; devuelve los canales creados.
export async function setupServer(guild) {
  const creados = [];
  for (const { categoria, canales } of LAYOUT) {
    const cat = await ensureCategory(guild, categoria);
    for (const c of canales) {
      if (findText(guild, c.nombre)) continue;
      await guild.channels.create({ name: c.nombre, type: ChannelType.GuildText, parent: cat.id, topic: c.tema });
      creados.push(`#${c.nombre}`);
    }
  }
  await ensureForo(guild);
  await ensureCarpeta(guild, GENERAL);
  await setupVoz(guild);
  await setupCrearProyectos(guild);
  if (creados.includes('#bienvenida')) await findText(guild, 'bienvenida').send({ embeds: [ayudaEmbed()] });
  return creados;
}

// ---------- slash commands ----------

const handlers = {
  async setup(interaction) {
    await interaction.deferReply(ephemeral);
    const creados = await setupServer(interaction.guild);
    await interaction.editReply(creados.length
      ? `✅ Servidor organizado. Canales creados: ${creados.join(', ')}`
      : '✅ Estructura verificada (voz general y AFK de 15 min incluidos).');
  },

  async proyecto(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'crear') {
      exigirCreador(interaction);
      return interaction.showModal(modalCrear({ autorId: interaction.user.id }));
    }

    if (sub === 'lista') {
      const ps = Object.values(db.proyectos).filter((p) => visible(interaction, p.id));
      if (!ps.length) return interaction.reply({ content: 'No tienes proyectos aún. Crea uno con `/proyecto crear`.', ...ephemeral });
      const lineas = ps.map((p) => `${p.estado} — **${p.nombre}** <#${p.channelId}>${p.github ? ` · [GitHub](${p.github})` : ''}${p.drive ? ` · [Drive](${p.drive})` : ''}`);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`📁 Tus proyectos (${ps.length})`).setDescription(lineas.join('\n').slice(0, 4000))],
        ...ephemeral,
      });
    }

    if (sub === 'info') {
      const p = resolverProyecto(interaction);
      return interaction.reply({ embeds: [proyectoEmbed(p)], ...ephemeral });
    }

    if (sub === 'miembros') {
      const p = proyectoGestionable(interaction, resolverProyecto(interaction));
      return interaction.showModal(modalMiembros(p));
    }

    if (sub === 'estado') {
      const p = proyectoGestionable(interaction, resolverProyecto(interaction));
      p.estado = interaction.options.getString('estado');
      save();
      await refrescarFicha(interaction.guild, p);
      return interaction.reply(`🔄 **${p.nombre}** ahora está en: ${p.estado}`);
    }

    if (sub === 'archivar') {
      const p = proyectoGestionable(interaction, resolverProyecto(interaction));
      await interaction.deferReply();
      await archivarProyecto(interaction.guild, p);
      return interaction.editReply(`🗄️ **${p.nombre}** archivado.`);
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
        ? { content: `✅ Link guardado${p ? ` en **${p.nombre}**` : ''}: ${driveTipo(url)} [${titulo}](<${url}>)`, ...(p ? ephemeral : {}) }
        : { content: 'Ese link ya estaba guardado.', ...ephemeral });
    }

    if (sub === 'lista') {
      const p = resolverProyecto(interaction, false);
      const links = getDb().links.filter((l) => (p ? l.proyecto === p.id : visible(interaction, l.proyecto)));
      if (!links.length) return interaction.reply({ content: 'No hay links guardados.', ...ephemeral });
      const lineas = links.slice(-30).map((l) => {
        const pr = l.proyecto ? getDb().proyectos[l.proyecto]?.nombre : null;
        return `${driveTipo(l.url)} [${l.titulo}](${l.url})${!p && pr ? ` — *${pr}*` : ''}`;
      });
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x0f9d58)
          .setTitle(`🔗 Links de Drive${p ? ` · ${p.nombre}` : ''} (${links.length})`)
          .setDescription(lineas.join('\n').slice(0, 4000))],
        ...ephemeral,
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
      exigirCreador(interaction);
      return interaction.showModal(modalCrear({
        ideaId: idea.id, nombre: idea.titulo, descripcion: idea.descripcion || idea.titulo, autorId: interaction.user.id,
      }));
    }
  },

  async archivo(interaction) {
    const sub = interaction.options.getSubcommand();
    const drive = interaction.options.getString('drive')?.trim();
    if (drive && !isDriveLink(drive)) throw new UserError('El link de respaldo debe ser de Google Drive/Docs.');

    if (sub === 'subir') {
      const p = interaction.options.getString('proyecto') ? resolverProyecto(interaction) : null;
      await interaction.deferReply(ephemeral);
      const { archivo, thread } = await guardarArchivo(interaction.guild, {
        attachment: interaction.options.getAttachment('archivo'), proyecto: p?.id,
        drive, descripcion: interaction.options.getString('descripcion'), autor: interaction.user.id,
      });
      return interaction.editReply(`✅ **${archivo.nombre}** guardado en <#${thread.id}>${drive ? '' : '\n⚠️ Sin respaldo en Drive: agrégalo con `/archivo respaldo`'}`);
    }

    if (sub === 'respaldo') {
      const valor = interaction.options.getString('archivo');
      const archivo = getDb().archivos.find((a) => String(a.id) === valor || a.nombre === valor);
      if (!archivo || !visible(interaction, archivo.proyecto)) throw new UserError('No encontré ese archivo.');
      await interaction.deferReply(ephemeral);
      await asignarRespaldo(interaction.guild, archivo, drive);
      return interaction.editReply(`☁️ Respaldo de **${archivo.nombre}** actualizado.`);
    }
  },

  async ayuda(interaction) {
    return interaction.reply({ embeds: [ayudaEmbed()], ...ephemeral });
  },
};

function ayudaEmbed() {
  return new EmbedBuilder().setColor(COLOR).setTitle('🤖 Cómo funciona este servidor').setDescription([
    '**Proyectos** (privados: solo los miembros los ven)',
    '`/proyecto crear` o el botón de #crear-proyectos — formulario: nombre, descripción, GitHub, Drive y miembros',
    'Requiere el rol **Creador de proyectos**',
    'Cada proyecto tiene su rol, chat, carpeta de archivos y canal de voz',
    '`/proyecto miembros` · `/proyecto lista` · `/proyecto info` · `/proyecto estado` · `/proyecto archivar`',
    '',
    '**Google Drive**',
    '`/drive agregar` — guarda un link (carpeta, doc, hoja, presentación)',
    '`/drive lista` — ver links (de un proyecto o todos)',
    '',
    '**Ideas**',
    '`/idea nueva` — publica en #ideas con votación e hilo de discusión',
    '`/idea lista` · `/idea aprobar` — convierte una idea en proyecto',
    '',
    '**Archivos**',
    '`/archivo subir` — guarda un archivo (en General o en un proyecto) con su respaldo en Drive',
    '`/archivo respaldo` — agrega el link de Drive a un archivo que no lo tiene',
    'El índice al inicio de cada carpeta lista todo ordenado por tipo y marca ⚠️ lo que no tiene respaldo.',
    '',
    '**Voz**: 🔊 General para todos · 💤 AFK tras 15 min sin actividad',
  ].join('\n'));
}

async function responderError(interaction, err) {
  const content = err instanceof UserError ? `⚠️ ${err.message}` : '⚠️ Ocurrió un error inesperado.';
  if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => {});
  else await interaction.reply({ content, ...ephemeral }).catch(() => {});
  if (!(err instanceof UserError)) console.error(err);
}

export async function handleCommand(interaction) {
  const handler = handlers[interaction.commandName];
  if (!handler) return;
  try {
    await handler(interaction);
  } catch (err) {
    await responderError(interaction, err);
  }
}

// ---------- botones y formularios ----------

function proyectoDeComponente(interaction, id) {
  const p = getDb().proyectos[id];
  if (!p) throw new UserError('Ese proyecto ya no existe.');
  return proyectoGestionable(interaction, p);
}

const componentes = {
  async 'boton:proyecto-panel'(interaction) {
    exigirCreador(interaction);
    return interaction.showModal(modalCrear({ autorId: interaction.user.id }));
  },

  // Botones de la ficha
  async 'boton:proyecto-miembros'(interaction, id) {
    return interaction.showModal(modalMiembros(proyectoDeComponente(interaction, id)));
  },
  async 'boton:proyecto-editar'(interaction, id) {
    return interaction.showModal(modalEditar(proyectoDeComponente(interaction, id)));
  },

  // Formularios
  async 'modal:proyecto-crear'(interaction, ideaId) {
    exigirCreador(interaction);
    const f = interaction.fields;
    const nombre = f.getTextInputValue('nombre').trim();
    const datos = {
      nombre,
      descripcion: f.getTextInputValue('descripcion').trim(),
      ...leerLinks(f),
      miembros: miembrosElegidos(f),
    };
    if (getDb().proyectos[slug(nombre)]) throw new UserError(`Ya existe el proyecto **${nombre}**.`);
    await interaction.deferReply(ephemeral);
    const p = await crearProyecto(interaction.guild, interaction.user.id, datos);
    if (p.drive) {
      await registrarLink(interaction.guild, { url: p.drive, titulo: `Carpeta de ${p.nombre}`, proyecto: p.id, autor: interaction.user.id }).catch(() => {});
    }
    const idea = ideaId && getDb().ideas.find((i) => String(i.id) === ideaId);
    if (idea) {
      idea.estado = 'aprobada';
      idea.proyecto = p.id;
      save();
      await findText(interaction.guild, 'ideas-aprobadas')
        ?.send(`✅ La idea **#${idea.id} ${idea.titulo}** ahora es un proyecto (${p.nombre}).`);
    }
    return interaction.editReply(`✅ Proyecto **${p.nombre}** creado: <#${p.channelId}> · rol <@&${p.roleId}> · ${p.miembros.length} miembro(s)`);
  },

  async 'modal:proyecto-miembros'(interaction, id) {
    const p = proyectoDeComponente(interaction, id);
    await interaction.deferReply(ephemeral);
    const { agregar, quitar } = await sincronizarMiembros(interaction.guild, p, miembrosElegidos(interaction.fields));
    await refrescarFicha(interaction.guild, p);
    if (agregar.length) {
      const chat = await interaction.guild.channels.fetch(p.channelId).catch(() => null);
      await chat?.send(`👋 Bienvenidos al proyecto ${agregar.map((m) => `<@${m}>`).join(' ')}`);
    }
    return interaction.editReply(`👥 Miembros de **${p.nombre}** actualizados: +${agregar.length} / −${quitar.length}`);
  },

  async 'modal:proyecto-editar'(interaction, id) {
    const p = proyectoDeComponente(interaction, id);
    const f = interaction.fields;
    const { github, drive } = leerLinks(f);
    p.descripcion = f.getTextInputValue('descripcion').trim();
    p.github = github;
    const driveNuevo = drive && drive !== p.drive;
    p.drive = drive;
    save();
    await interaction.deferReply(ephemeral);
    if (driveNuevo) await registrarLink(interaction.guild, { url: drive, titulo: `Carpeta de ${p.nombre}`, proyecto: p.id, autor: interaction.user.id });
    await refrescarFicha(interaction.guild, p);
    return interaction.editReply(`✏️ **${p.nombre}** actualizado.`);
  },
};

function leerLinks(fields) {
  const GITHUB_RE = /^https?:\/\/(www\.)?github\.com\/[\w.-]+(\/[\w.-]+)?\/?$/i;
  const github = fields.getTextInputValue('github')?.trim() || null;
  const drive = fields.getTextInputValue('drive')?.trim() || null;
  if (github && !GITHUB_RE.test(github)) throw new UserError('El link de GitHub no es válido (ej: https://github.com/usuario/repo).');
  if (drive && !isDriveLink(drive)) throw new UserError('El link de Drive no es válido (debe ser drive.google.com o docs.google.com).');
  return { github, drive };
}

export async function handleComponent(interaction) {
  const tipo = interaction.isModalSubmit() ? 'modal' : 'boton';
  const [accion, arg] = interaction.customId.split(':');
  const handler = componentes[`${tipo}:${accion}`];
  if (!handler) return;
  try {
    await handler(interaction, arg);
  } catch (err) {
    await responderError(interaction, err);
  }
}

// ---------- autocompletado ----------

export async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  const q = slug(focused.value ?? '');
  let opciones;
  if (focused.name === 'archivo') {
    opciones = getDb().archivos
      .filter((a) => visible(interaction, a.proyecto) && slug(a.nombre).includes(q))
      .sort((a, b) => Number(!!a.drive) - Number(!!b.drive) || b.id - a.id)
      .slice(0, 25)
      .map((a) => ({ name: `${a.drive ? '☁️' : '⚠️'} #${a.id} ${a.nombre}`.slice(0, 100), value: String(a.id) }));
  } else {
    opciones = Object.values(getDb().proyectos)
      .filter((p) => visible(interaction, p.id) && p.id.includes(q))
      .slice(0, 25)
      .map((p) => ({ name: p.nombre.slice(0, 100), value: p.nombre.slice(0, 100) }));
  }
  await interaction.respond(opciones).catch(() => {});
}
