import {
  SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageType,
} from 'discord.js';
import {
  getDb, slug, findProyecto, findProyectoByChannel, addLink, save, githubDe, vincularGithub, desvincularGithub,
} from '../store.js';
import {
  githubConfigurado, loginConfigurado, iniciarLogin, esperarLogin, crearRepo,
} from '../githubApi.js';
import { isDriveLink, driveTipo } from '../drive.js';
import {
  ensureCarpeta, guardarArchivo, asignarRespaldo, GENERAL,
} from '../carpetas.js';
import {
  CANALES, COLORES, canal, ensureCanal, ordenar, mencion,
} from '../layout.js';
import {
  UserError, modalCrear, modalMiembros, modalEditar, proyectoEmbed, refrescarFicha,
  crearProyecto, sincronizarMiembros, miembrosElegidos, puedeGestionar, archivarProyecto,
  avisarGithub, invitarAProyectos, alternarPausa, modalEliminar, eliminarProyecto, actualizarProyecto, recuperarProyectos,
} from '../proyectos.js';
import { publicarResumen } from '../resumen.js';
import { revisarSkills } from '../skillsMonitor.js';
import { prepararRepo, guiaSkillsEmbed } from '../plantillaRepo.js';
import {
  modalIdea, publicarIdea, VOTOS_NECESARIOS, SI, NO,
} from '../ideas.js';
import { modalVideo, modalDrive, crearVideo, videoPorId, subirDrive } from '../videos.js';
import {
  refrescarTarjetaDeProyecto, vincularTarjeta, ensureEtiquetas, publicarTarjeta, avance,
} from '../tarjetas.js';
import {
  ensureCanalesTareas, marcar, modalTareaExtra, agregarTareaExtra, proyectoPorCanalExtra,
  sincronizarIssues, reiniciarIssues, refrescarTablero,
} from '../tareas.js';
import { conectarGithub, instrucciones } from '../github.js';

const AFK_SEGUNDOS = 900; // 15 minutos
const ROL_CREADOR = 'Creador de proyectos';
const ephemeral = { flags: MessageFlags.Ephemeral };
// Usuarios con un inicio de sesión de GitHub pendiente (uno a la vez por persona).
const loginsEnCurso = new Set();

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
    .addSubcommand((s) => s.setName('github').setDescription('Conecta el repo de GitHub al canal de commits')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('preparar-repo').setDescription('Crea el repo si falta y le agrega las skills del equipo y el git workflow')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('pausar').setDescription('Pausa o reanuda un proyecto (el resto del estado es automático)')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('actualizar').setDescription('Revisa la conexión con GitHub y refresca issues, tableros, ficha y publicación')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('eliminar').setDescription('Elimina el proyecto: canales, rol, tareas y su publicación en aprobados')
      .addStringOption((o) => proyectoOption(o, false)))
    .addSubcommand((s) => s.setName('recuperar').setDescription('Vuelve a registrar los proyectos que siguen en Discord pero el bot olvidó (admins)'))
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
    .setName('idea-base')
    .setDescription('Propone una idea (solo en el canal de ideas)'),

  new SlashCommandBuilder()
    .setName('idea-video')
    .setDescription('Crea una publicación en ideas de videos: nombre, descripción, referencia y Drive opcional'),

  new SlashCommandBuilder()
    .setName('github')
    .setDescription('Tu cuenta de GitHub (para recibir invitaciones a los repos de tus proyectos)')
    .addSubcommand((s) => s.setName('vincular').setDescription('Inicia sesión en GitHub para vincular tu cuenta'))
    .addSubcommand((s) => s.setName('desvincular').setDescription('Quita tu cuenta de GitHub vinculada')
      .addUserOption((o) => o.setName('miembro').setDescription('Solo administradores: desvincular a otra persona')))
    .addSubcommand((s) => s.setName('equipo').setDescription('Muestra las cuentas de GitHub vinculadas')),

  new SlashCommandBuilder()
    .setName('tarea-extra')
    .setDescription('Agrega una tarea o arreglo (solo en el canal 🧩・tareas-extra de un proyecto)'),

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

  new SlashCommandBuilder()
    .setName('resumen')
    .setDescription('Publica ahora el resumen semanal en el canal general')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('skills-revisar')
    .setDescription('Revisa ahora si las skills publicadas tienen actualizaciones en GitHub')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder().setName('ayuda').setDescription('Muestra cómo usar el bot'),
];

// ---------- helpers ----------

const esAdmin = (interaction) => interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles);

// El botón apunta a un proyecto que no está en db.json: casi siempre la base se perdió al redesplegar sin volumen.
const NO_EN_BD = 'No encuentro este proyecto en la base de datos del bot (no es un problema de permisos). Si el bot se redesplegó hace poco, '
  + 'perdió sus datos: revisa que en Railway haya un **volumen montado en `/data`** y luego un admin usa `/proyecto recuperar`.';

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

// Intenta conectar el repo; si no se puede automáticamente, muestra los pasos (solo a quien lo pidió).
async function responderGithub(interaction, p) {
  await interaction.deferReply(ephemeral);
  const { ok } = await conectarGithub(interaction.guild, p);
  await refrescarFicha(interaction.guild, p);
  if (ok) return interaction.editReply(`✅ ${p.github} conectado: los commits llegarán a <#${p.commitsId}>.`);
  if (!p.github) return interaction.editReply('Primero agrega el link del repositorio con el botón ✏️ Editar de la ficha.');
  return interaction.editReply({ embeds: [instrucciones(p)] });
}

function proyectoGestionable(interaction, p) {
  if (!puedeGestionar(interaction, p)) throw new UserError('Solo quien creó el proyecto o un administrador puede cambiar esto. Los miembros pueden ver y escribir.');
  return p;
}

export async function registrarLink(guild, { url, titulo, proyecto, autor, origen }) {
  const saved = addLink({ url, titulo, proyecto: proyecto ?? null, autor });
  if (!saved) return false;
  const p = proyecto ? getDb().proyectos[proyecto] : null;
  // Los links de proyectos privados se anuncian en su propio chat, no en el canal público.
  const log = p ? await guild.channels.fetch(p.channelId).catch(() => null) : canal(guild, 'linksDrive');
  await log?.send({
    embeds: [new EmbedBuilder().setColor(COLORES.drive)
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
  await ensureCanal(guild, 'vozGeneral');
  const { canal: afk } = await ensureCanal(guild, 'afk', {
    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Speak] }],
  });
  if (guild.afkChannelId !== afk.id) await guild.setAFKChannel(afk);
  if (guild.afkTimeout !== AFK_SEGUNDOS) await guild.setAFKTimeout(AFK_SEGUNDOS);
}

// Crear proyectos: todos ven el canal, solo el rol "Creador de proyectos" escribe. Tiene el panel con el botón.
async function setupCrearProyectos(guild) {
  const rol = guild.roles.cache.find((r) => r.name === ROL_CREADOR)
    ?? await guild.roles.create({ name: ROL_CREADOR, color: COLORES.exito, mentionable: true, reason: 'Puede crear proyectos' });
  const { canal: c } = await ensureCanal(guild, 'crear');
  await c.permissionOverwrites.set([
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.AddReactions] },
    { id: rol.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.AddReactions] },
  ]);
  const tema = `Crea proyectos con el botón o /proyecto crear. Solo ${ROL_CREADOR} puede escribir aquí.`;
  if (c.topic !== tema) await c.setTopic(tema);

  const contenido = {
    embeds: [new EmbedBuilder().setColor(COLORES.exito).setTitle('Crear un proyecto').setDescription([
      'Pulsa **Crear proyecto** para abrir el formulario.',
      '',
      '**El formulario pide**',
      '› Nombre y descripción',
      '› Repositorio de GitHub',
      '› Carpeta de Google Drive',
      '› Miembros del equipo',
      '',
      '**Se crea automáticamente**',
      '› Un rol y una categoría privada para el equipo',
      `› ${PROYECTO_CANALES}`,
      '',
      `-# Solo <@&${rol.id}> puede crear proyectos y escribir en este canal.`,
    ].join('\n'))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('proyecto-panel').setLabel('Crear proyecto').setEmoji('🚀').setStyle(ButtonStyle.Success),
    )],
    allowedMentions: { parse: [] },
  };
  await publicarFijo(c, 'panelCrear', contenido);
}

// Publica o actualiza un mensaje fijo del bot (guardando su ID en la base).
async function publicarFijo(c, clave, contenido) {
  const db = getDb();
  const previo = db[clave] && await c.messages.fetch(db[clave]).catch(() => null);
  if (previo) return previo.edit(contenido);
  const msg = await c.send(contenido);
  await msg.pin().catch(() => {});
  // Quitar el aviso automático "fijó un mensaje" para que el canal quede limpio.
  const aviso = (await c.messages.fetch({ limit: 5 }).catch(() => null))?.find((x) => x.type === MessageType.ChannelPinnedMessage);
  await aviso?.delete().catch(() => {});
  db[clave] = msg.id;
  save();
  return msg;
}

const PROYECTO_CANALES = 'Chat, carpeta de archivos, canal de commits de GitHub y sala de voz';

// Crea o actualiza toda la estructura base con el estilo actual; devuelve los canales creados.
export async function setupServer(guild) {
  const creados = [];
  for (const key of Object.keys(CANALES)) {
    if (['crear', 'vozGeneral', 'afk'].includes(key)) continue;
    const { creado } = await ensureCanal(guild, key);
    if (creado) creados.push(CANALES[key].nombre);
  }
  await ensureCarpeta(guild, GENERAL);
  await setupVoz(guild);
  await setupCrearProyectos(guild);
  await ordenar(guild);
  await setupFuncionamiento(guild);
  await soloLectura(guild, 'ideas', { reacciones: true });
  await migrarAprobadasAForo(guild);
  await soloLectura(guild, 'ideasAprobadas');
  await soloLectura(guild, 'skills');
  await soloLectura(guild, 'videos', { comentarios: true });
  await ensureEtiquetas(canal(guild, 'ideasAprobadas'));
  for (const p of Object.values(getDb().proyectos)) {
    if (!p.archivado) await ensureCanalesTareas(guild, p).catch((e) => console.error(`Tareas de ${p.id}:`, e.message));
    // Todo proyecto tiene su publicación en el foro de aprobados.
    const ideaDeP = getDb().ideas.find((i) => i.proyecto === p.id);
    const thread = p.tarjetaId && await guild.channels.fetch(p.tarjetaId).catch(() => null);
    if (!thread) await publicarTarjeta(guild, { p, idea: ideaDeP });
    else await refrescarTarjetaDeProyecto(guild, p.id);
  }
  return creados;
}

// ---------- slash commands ----------

const handlers = {
  async setup(interaction) {
    await interaction.deferReply(ephemeral);
    const creados = await setupServer(interaction.guild);
    await interaction.editReply(creados.length
      ? `✅ Servidor organizado. Canales creados: ${creados.join(', ')}`
      : '✅ Estructura verificada y actualizada al estilo actual.');
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
      const lineas = ps.map((p) => `${avance(p).etapa} — **${p.nombre}** <#${p.channelId}>${p.github ? ` · [GitHub](${p.github})` : ''}${p.drive ? ` · [Drive](${p.drive})` : ''}`);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORES.primario).setTitle(`◆ Tus proyectos (${ps.length})`).setDescription(lineas.join('\n').slice(0, 4000))],
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

    if (sub === 'github') {
      const p = proyectoGestionable(interaction, resolverProyecto(interaction));
      return responderGithub(interaction, p);
    }

    if (sub === 'preparar-repo') {
      const p = proyectoGestionable(interaction, resolverProyecto(interaction));
      await interaction.deferReply(ephemeral);
      let creado = false;
      if (!p.github) {
        // Proyecto sin repo (p. ej. falló la creación): se crea ahora y se conecta.
        if (!githubConfigurado()) return interaction.editReply('⚠️ Falta `GITHUB_PAT` en el servidor del bot para crear el repo.');
        try {
          p.github = (await crearRepo(p.id, p.descripcion)).url;
          p.errorRepo = null;
          creado = true;
          save();
        } catch (err) {
          p.errorRepo = err.message;
          save();
          await refrescarFicha(interaction.guild, p);
          return interaction.editReply(`⚠️ No se pudo crear el repo: ${err.message}`);
        }
        await conectarGithub(interaction.guild, p).catch(() => {});
        await sincronizarIssues(interaction.guild, p).catch(() => {});
        await refrescarFicha(interaction.guild, p);
        await refrescarTarjetaDeProyecto(interaction.guild, p.id).catch(() => {});
      }
      let resultado;
      try {
        resultado = await prepararRepo(p.github);
        p.repoPreparado = true;
        save();
      } catch (err) {
        resultado = { ok: false, error: err.message.slice(0, 200) };
      }
      const chat = await interaction.guild.channels.fetch(p.channelId).catch(() => null);
      if (resultado.ok) await chat?.send({ embeds: [guiaSkillsEmbed(p, resultado)] }).catch(() => {});
      const inicio = creado ? `🐙 Repo creado: ${p.github}\n` : '';
      return interaction.editReply(inicio + (resultado.ok
        ? (resultado.sinCambios ? '✅ El repo ya tenía las skills y el git workflow.' : `✅ Repo preparado: ${resultado.skills?.length ?? 0} skills, git workflow y rama develop. Avisé en <#${p.channelId}>.`)
        : `⚠️ No se pudo preparar el repo: ${resultado.error}`));
    }

    if (sub === 'pausar') {
      const p = proyectoGestionable(interaction, resolverProyecto(interaction));
      await interaction.deferReply(ephemeral);
      const pausado = await alternarPausa(interaction.guild, p);
      return interaction.editReply(pausado ? `⏸️ **${p.nombre}** pausado.` : `▶️ **${p.nombre}** reanudado.`);
    }

    if (sub === 'actualizar') {
      const p = resolverProyecto(interaction);
      await interaction.deferReply(ephemeral);
      return interaction.editReply((await actualizarProyecto(interaction.guild, p)).join('\n'));
    }

    if (sub === 'recuperar') {
      if (!esAdmin(interaction)) throw new UserError('Solo quien puede gestionar roles puede recuperar proyectos.');
      await interaction.deferReply(ephemeral);
      const { recuperados, omitidos } = await recuperarProyectos(interaction.guild, interaction.user.id);
      return interaction.editReply([
        recuperados.length ? `✅ Recuperé ${recuperados.length} proyecto(s): ${recuperados.map((p) => `**${p.nombre}**${p.github ? '' : ' (sin repo)'}`).join(', ')}.`
          : 'No encontré proyectos sin registrar: todas las categorías ◆ ya están en la base de datos.',
        omitidos.length ? `⚠️ Omitidos: ${omitidos.join(', ')}` : '',
        recuperados.length ? '-# Se recuperan canales, rol, repo, Drive, miembros, webhook y publicación. Los links y archivos registrados antes no se pueden recuperar.' : '',
      ].filter(Boolean).join('\n'));
    }

    if (sub === 'eliminar') {
      const p = proyectoGestionable(interaction, resolverProyecto(interaction));
      return interaction.showModal(modalEliminar(p));
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
        embeds: [new EmbedBuilder().setColor(COLORES.drive)
          .setTitle(`🔗 Links de Drive${p ? ` · ${p.nombre}` : ''} (${links.length})`)
          .setDescription(lineas.join('\n').slice(0, 4000))],
        ...ephemeral,
      });
    }
  },

  async 'idea-video'(interaction) {
    return interaction.showModal(modalVideo());
  },

  async 'idea-base'(interaction) {
    const ideas = canal(interaction.guild, 'ideas');
    if (interaction.channelId !== ideas?.id) throw new UserError(`Este comando solo se usa en ${mencion(interaction.guild, 'ideas')}.`);
    return interaction.showModal(modalIdea());
  },

  async github(interaction) {
    const sub = interaction.options.getSubcommand();
    const otro = interaction.options.getUser('miembro');
    if (otro && otro.id !== interaction.user.id && !esAdmin(interaction)) {
      throw new UserError('Solo un administrador puede vincular o desvincular a otra persona.');
    }
    const persona = otro ?? interaction.user;

    if (sub === 'vincular') {
      if (!loginConfigurado()) {
        throw new UserError('El inicio de sesión con GitHub no está configurado todavía (falta GITHUB_CLIENT_ID). Avísale a un administrador.');
      }
      if (loginsEnCurso.has(interaction.user.id)) throw new UserError('Ya tienes un inicio de sesión en curso: termina el anterior o espera a que venza.');
      await interaction.deferReply(ephemeral);
      const login = await iniciarLogin();
      loginsEnCurso.add(interaction.user.id);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORES.github).setTitle('🐙 Vincula tu cuenta de GitHub').setDescription([
          `1. Abre **${login.url}** (botón de abajo) e inicia sesión con tu cuenta.`,
          '2. Escribe este código:',
          `# \`${login.codigo}\``,
          '3. Pulsa **Authorize**. Este mensaje se actualiza solo cuando termines.',
          '',
          '-# El bot solo lee tu nombre de usuario; no guarda acceso a tu cuenta. El código vence en 15 minutos.',
        ].join('\n'))],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setURL(login.url).setLabel('Abrir GitHub').setEmoji('🔑').setStyle(ButtonStyle.Link),
        )],
      });
      try {
        const usuario = await esperarLogin(login);
        const otro = Object.entries(getDb().usuarios).find(([id, u]) => id !== interaction.user.id && u.github?.toLowerCase() === usuario.toLowerCase());
        if (otro) {
          return await interaction.editReply({ content: `⚠️ La cuenta **${usuario}** ya está vinculada a <@${otro[0]}>.`, embeds: [], components: [] });
        }
        vincularGithub(interaction.user.id, usuario);
        const proyectos = await invitarAProyectos(interaction.guild, interaction.user.id);
        return await interaction.editReply({
          content: [
            `✅ Cuenta vinculada: **[${usuario}](https://github.com/${usuario})**.`,
            proyectos.length ? `📨 Invitación enviada a los repos de: ${proyectos.map((p) => `**${p.nombre}**`).join(', ')}.` : '',
          ].filter(Boolean).join('\n'),
          embeds: [],
          components: [],
        });
      } catch (err) {
        return await interaction.editReply({ content: `⚠️ ${err.message}`, embeds: [], components: [] }).catch(() => {});
      } finally {
        loginsEnCurso.delete(interaction.user.id);
      }
    }

    if (sub === 'desvincular') {
      desvincularGithub(persona.id);
      return interaction.reply({ content: `Cuenta de GitHub de <@${persona.id}> desvinculada.`, ...ephemeral });
    }

    if (sub === 'equipo') {
      await interaction.guild.members.fetch().catch(() => {});
      const lineas = Object.entries(getDb().usuarios).filter(([, u]) => u.github)
        .map(([id, u]) => `<@${id}> → [${u.github}](https://github.com/${u.github})`);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORES.github).setTitle('🐙 Cuentas de GitHub vinculadas')
          .setDescription(lineas.join('\n') || 'Nadie ha vinculado su cuenta. Usa `/github vincular`.')
          .setFooter({ text: githubConfigurado() ? 'Las invitaciones a los repos se envían automáticamente' : 'Falta GITHUB_PAT: el bot aún no puede enviar invitaciones' })],
        ...ephemeral,
      });
    }
  },

  async 'tarea-extra'(interaction) {
    const p = proyectoPorCanalExtra(interaction.channelId);
    if (!p) throw new UserError('Este comando solo se usa en el canal 🧩・tareas-extra de un proyecto.');
    if (!visible(interaction, p.id)) throw new UserError('Solo los miembros del proyecto pueden agregar tareas.');
    if (!avance(p).enProduccion) {
      throw new UserError('Las tareas extra se habilitan cuando el proyecto llega a producción (todos los issues cerrados). Mientras tanto, créalas como issues en GitHub.');
    }
    return interaction.showModal(modalTareaExtra());
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

  async resumen(interaction) {
    await interaction.deferReply(ephemeral);
    const msg = await publicarResumen(interaction.guild);
    return interaction.editReply(msg ? `📊 Resumen publicado en <#${msg.channelId}>.` : 'No encontré el canal general.');
  },

  async 'skills-revisar'(interaction) {
    await interaction.deferReply(ephemeral);
    const r = await revisarSkills(interaction.guild);
    const icono = { actualizada: '🔄', 'sin cambios': '✅', 'referencia guardada': '📌', error: '⚠️' };
    return interaction.editReply(r.length
      ? r.map((x) => `${icono[x.estado] ?? '•'} **${x.nombre}**: ${x.estado}${x.detalle ? ` (${x.detalle})` : ''}`).join('\n')
      : 'No encontré el foro de skills.');
  },

  async ayuda(interaction) {
    const [parte1, parte2] = guiaEmbeds(interaction.guild);
    await interaction.reply({ embeds: parte1, ...ephemeral });
    return interaction.followUp({ embeds: parte2, ...ephemeral });
  },
};

// El antiguo canal de texto de proyectos aprobados se reemplaza por el foro (si solo tiene mensajes del bot).
async function migrarAprobadasAForo(guild) {
  const viejo = guild.channels.cache.find((c) => c.type === ChannelType.GuildText
    && [CANALES.ideasAprobadas.nombre, '✅・ideas-aprobadas', 'ideas-aprobadas'].includes(c.name));
  if (!viejo) return;
  const mensajes = await viejo.messages.fetch({ limit: 100 }).catch(() => null);
  if (mensajes?.some((m) => !m.author.bot)) {
    await viejo.setName('aprobados-antiguo').catch(() => {});
  } else {
    await viejo.delete('Reemplazado por el foro de proyectos aprobados').catch(() => {});
  }
  if (getDb().canales.ideasAprobadas === viejo.id) {
    delete getDb().canales.ideasAprobadas;
    save();
  }
}

// Nadie escribe; con reacciones: true se puede votar con los emojis existentes pero no agregar otros.
// Con comentarios: true (foros) solo el bot crea publicaciones, pero todos pueden responder y reaccionar dentro.
async function soloLectura(guild, key, { reacciones = false, comentarios = false } = {}) {
  const { canal: c } = await ensureCanal(guild, key);
  const deny = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads,
    ...(comentarios ? [] : [PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AddReactions])];
  const allow = [...(reacciones ? [PermissionFlagsBits.UseApplicationCommands] : []),
    ...(comentarios ? [PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AddReactions] : [])];
  await c.permissionOverwrites.set([
    { id: guild.roles.everyone.id, deny, allow },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ManageMessages] },
  ]);
  if (CANALES[key].tema && c.topic !== CANALES[key].tema) await c.setTopic(CANALES[key].tema);
}

// Canal de solo lectura con la guía completa; el bot la mantiene actualizada.
export async function setupFuncionamiento(guild) {
  const { canal: c } = await ensureCanal(guild, 'funcionamiento');
  await c.permissionOverwrites.set([
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads] },
  ]);
  // Sin los IDs guardados (p. ej. se perdió db.json) se reutilizan los mensajes fijados para no duplicar la guía.
  const db = getDb();
  if (!db.mensajeFuncionamiento || !db.mensajeFuncionamiento2) {
    const fijados = [...(await c.messages.fetchPinned().catch(() => new Map())).values()].filter((x) => x.author.id === guild.members.me.id);
    db.mensajeFuncionamiento ??= fijados.find((x) => x.embeds[0]?.title?.startsWith('📖'))?.id;
    db.mensajeFuncionamiento2 ??= fijados.find((x) => x.embeds[0]?.title?.startsWith('📁'))?.id;
  }
  const [parte1, parte2] = guiaEmbeds(guild);
  await publicarFijo(c, 'mensajeFuncionamiento', { embeds: parte1, allowedMentions: { parse: [] } });
  await publicarFijo(c, 'mensajeFuncionamiento2', { embeds: parte2, allowedMentions: { parse: [] } });
}

// La guía va en dos mensajes: Discord permite 6000 caracteres de embeds por mensaje.
function guiaEmbeds(guild) {
  const m = (key) => mencion(guild, key);
  const rolCreador = guild?.roles.cache.find((r) => r.name === ROL_CREADOR);
  const creador = rolCreador ? `<@&${rolCreador.id}>` : `**${ROL_CREADOR}**`;
  const embed = (titulo, color) => new EmbedBuilder().setColor(color).setTitle(titulo);

  const parte1 = [
    embed('📖 Funcionamiento del servidor', COLORES.primario).setDescription([
      'Este servidor organiza los **proyectos, archivos, links de Drive, ideas, videos y commits** del equipo.',
      'Todo se maneja con comandos: escribe `/` en cualquier canal para verlos. `/ayuda` muestra esta guía solo a ti.',
      '',
      `**${m('crear')}** — crear proyectos`,
      `**${m('general')}** — conversación y resumen semanal`,
      `**${m('ideas')}** — proponer y votar ideas`,
      `**${m('ideasAprobadas')}** — una publicación por proyecto: estado, equipo y progreso`,
      `**${m('videos')}** — ideas de videos y su Drive cuando están listos`,
      `**${m('archivos')}** · **${m('linksDrive')}** — archivos y links de Drive generales`,
      `**${m('skills')}** — skills recomendadas; el bot avisa cuando se actualizan`,
      `**${m('vozGeneral')}** — sala de voz del equipo`,
    ].join('\n')),

    embed('🔑 Roles y permisos', COLORES.aviso).addFields(
      { name: 'Administrador', value: 'Puede hacer todo: gestionar cualquier proyecto, `/setup`, `/proyecto recuperar`, `/resumen` y `/skills-revisar`.' },
      { name: ROL_CREADOR, value: `${creador} crea proyectos (botón o \`/proyecto crear\`) y escribe en ${m('crear')}.` },
      { name: '⭐ Responsable', value: 'Quien creó el proyecto. Asigna el equipo, edita sus datos, lo pausa, conecta GitHub, prepara el repo, archiva y elimina.' },
      { name: '◆ Rol del proyecto', value: 'Los miembros **ven y escriben** en su chat, suben archivos a su carpeta, leen sus commits y tareas y entran a su voz. No cambian los datos.' },
      { name: 'Todos', value: 'Proponer y votar ideas, crear ideas de videos, subir archivos y links generales, vincular su GitHub y usar la voz general.' },
    ),

    embed('◆ Proyectos', COLORES.primario).setDescription([
      'Cada proyecto tiene un **rol** y una **categoría privada**: `💬・chat` (con la ficha fijada), `📁・archivos`, `📡・commits`, `📋・tareas` (issues de GitHub), `🧩・tareas-extra` y `🎙️ Reunión`.',
      'Botones de la ficha: 👥 Miembros · ✏️ Editar · ⏸️ Pausar · 🔄 Actualizar · 🗑️ Eliminar · 📡 Conectar GitHub.',
    ].join('\n')).addFields(
      { name: '`/proyecto crear`', value: `Formulario: nombre, descripción, GitHub (vacío = el bot crea el repo), Drive y miembros. · ${ROL_CREADOR}` },
      { name: '`/proyecto lista` · `/proyecto info`', value: 'Tus proyectos o la ficha de uno. · Miembros' },
      { name: '`/proyecto miembros`', value: 'Agrega o quita personas: da el rol y las invita al repo. · Responsable' },
      { name: '`/proyecto actualizar`', value: 'Revisa GitHub y refresca issues, tableros, ficha y aprobados. · Miembros' },
      { name: '`/proyecto pausar`', value: 'Pausa o reanuda. El resto del estado es automático: ⏳ Por iniciar → 🛠️ Desarrollo → 🚀 Producción → 🔧 Mantenimiento. · Responsable' },
      { name: '`/proyecto github` · `/proyecto preparar-repo`', value: 'Conecta el repo al canal de commits · crea el repo si falta y le agrega las skills, el git workflow y el hook 🛡️ de protección. · Responsable' },
      { name: '`/proyecto archivar` · `/proyecto eliminar`', value: 'Pasa a ◇ terminado · borra canales, rol, tareas y su publicación pidiendo escribir el nombre (el repo se conserva). · Responsable' },
      { name: '`/tarea-extra`', value: 'Solo en `🧩・tareas-extra` y en producción: agrega un arreglo o añadido. El menú las marca hechas o las reabre. · Miembros' },
    ),
  ];

  const parte2 = [
    embed('📁 Archivos y 🔗 Drive', COLORES.archivos).addFields(
      { name: '`/archivo subir`', value: 'Guarda un archivo con su respaldo en Drive, en la carpeta General o en la del proyecto. · Todos / miembros' },
      { name: '`/archivo respaldo`', value: 'Agrega o cambia el link de Drive de un archivo (primero los ⚠️ sin respaldo). · Todos / miembros' },
      { name: '`/drive agregar` · `/drive lista`', value: `Guarda y lista links de Drive: los generales en ${m('linksDrive')}, los de un proyecto en su chat. Los links pegados en un chat también se guardan. · Todos / miembros` },
    ),

    embed('💡 Ideas y 🎬 Videos', COLORES.ideas).addFields(
      { name: '`/idea-base`', value: `Solo en ${m('ideas')}: formulario con nombre y descripción; se vota con ${SI} y ${NO}. · Todos` },
      { name: 'Votación', value: `**${VOTOS_NECESARIOS} ${SI}** la aprueban: el bot crea el proyecto, su repo y su publicación en ${m('ideasAprobadas')}. **${VOTOS_NECESARIOS} ${NO}** la descartan. Las reacciones del bot no cuentan.` },
      { name: '`/idea-video`', value: `Publica en ${m('videos')} nombre, descripción, referencia y Drive (opcional). Listo el video, el botón **☁️ Subir Drive** lo marca ✅. Se comenta dentro. · Todos` },
    ),

    embed('🐙 GitHub', COLORES.github).addFields(
      { name: '`/github vincular` · `/github desvincular`', value: 'Inicias sesión en GitHub con un código y tu cuenta queda vinculada: al entrar a un proyecto te invita a su repo y te quita el acceso si sales. · Todos' },
      { name: '`/github equipo`', value: 'Muestra la cuenta de GitHub de cada persona. · Todos' },
      { name: 'Commits e issues', value: 'Cada push, PR, issue y release llega a `📡・commits`. Los issues se crean y asignan en GitHub; el bot los lee cada 5 min (👤 asignado, 🔍 PR en revisión con "closes #N", ✅ cerrado). Nunca modifica GitHub.' },
      { name: 'Repos del equipo', value: `Los repos que crea el bot traen las skills de ${m('skills')}, las normas de Git y el hook 🛡️ que impide que Claude borre la base de datos o haga force push a main.` },
    ),

    embed('⚙️ Automático y administración', COLORES.aviso).addFields(
      { name: 'Resumen semanal', value: `Cada lunes en ${m('general')}: avance por proyecto, lo cerrado, lo sin asignar y quién tiene qué. \`/resumen\` lo publica al momento. · Admins` },
      { name: 'Skills', value: `Cada día a las 2 a. m. el bot revisa las skills de ${m('skills')} y avisa en su publicación si cambiaron. \`/skills-revisar\` lo hace al momento. · Admins` },
      { name: '`/setup`', value: 'Crea o repara categorías, canales, permisos, etiquetas y esta guía. · Admins' },
      { name: '`/proyecto recuperar`', value: 'Vuelve a registrar los proyectos que siguen en Discord pero el bot olvidó (por ejemplo, tras perder su base de datos). · Admins' },
      { name: 'Voz', value: `Tras **15 minutos** sin actividad, Discord te mueve a ${m('afk')}.` },
    ).setFooter({ text: guild?.name ?? 'Servidor' }),
  ];
  return [parte1, parte2];
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
  if (!p) throw new UserError(NO_EN_BD);
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
  async 'boton:proyecto-github'(interaction, id) {
    return responderGithub(interaction, proyectoDeComponente(interaction, id));
  },
  // Cualquier miembro puede refrescar (no cambia datos del proyecto).
  async 'boton:proyecto-actualizar'(interaction, id) {
    const p = getDb().proyectos[id];
    if (!p) throw new UserError(NO_EN_BD);
    if (!visible(interaction, p.id)) throw new UserError('Solo los miembros del proyecto pueden actualizarlo.');
    await interaction.deferReply(ephemeral);
    return interaction.editReply((await actualizarProyecto(interaction.guild, p)).join('\n'));
  },

  async 'boton:proyecto-eliminar'(interaction, id) {
    return interaction.showModal(modalEliminar(proyectoDeComponente(interaction, id)));
  },

  async 'modal:proyecto-eliminar'(interaction, id) {
    const p = proyectoDeComponente(interaction, id);
    const escrito = interaction.fields.getTextInputValue('confirmacion').trim();
    if (escrito.toLowerCase() !== p.nombre.toLowerCase()) {
      throw new UserError(`El nombre no coincide ("${escrito}"). No se eliminó nada.`);
    }
    await interaction.deferReply(ephemeral);
    const { nombre } = p;
    const borrados = await eliminarProyecto(interaction.guild, p);
    // Si el comando se usó dentro del proyecto, ese canal ya no existe: la respuesta puede fallar.
    return interaction.editReply(`🗑️ **${nombre}** eliminado: ${borrados.join(', ')}. El repo de GitHub se conserva.`).catch(() => {});
  },

  async 'boton:proyecto-pausa'(interaction, id) {
    const p = proyectoDeComponente(interaction, id);
    await interaction.deferReply(ephemeral);
    const pausado = await alternarPausa(interaction.guild, p);
    return interaction.editReply(pausado ? `⏸️ **${p.nombre}** pausado.` : `▶️ **${p.nombre}** reanudado.`);
  },
  async 'boton:proyecto-editar'(interaction, id) {
    return interaction.showModal(modalEditar(proyectoDeComponente(interaction, id)));
  },

  // Formularios
  async 'boton:idea-proyecto'(interaction, ideaId) {
    exigirCreador(interaction);
    const idea = getDb().ideas.find((i) => String(i.id) === ideaId && i.estado === 'aprobada');
    if (!idea) throw new UserError('Esa idea ya no está disponible.');
    if (idea.proyecto) throw new UserError('Esa idea ya tiene proyecto.');
    return interaction.showModal(modalCrear({
      ideaId: idea.id, nombre: idea.titulo, descripcion: idea.descripcion.slice(0, 1000), autorId: interaction.user.id,
    }));
  },

  async 'boton:tareas-sync'(interaction, proyectoId) {
    const p = getDb().proyectos[proyectoId];
    if (!p) throw new UserError(NO_EN_BD);
    if (!visible(interaction, p.id)) throw new UserError('Solo los miembros del proyecto pueden sincronizar.');
    await interaction.deferReply(ephemeral);
    p.issuesEtag = null;
    p.prsEtag = null;
    await sincronizarIssues(interaction.guild, p);
    const issues = (p.tareas ?? []).filter((t) => t.origen === 'github');
    return interaction.editReply(p.errorIssues
      ? `⚠️ ${p.errorIssues}`
      : `🔄 Sincronizado: ${issues.length} issue(s), ${issues.filter((t) => t.estado !== 'hecha').length} abierto(s), ${(p.prs ?? []).length} PR en revisión.`);
  },

  async 'select:tarea-hecha'(interaction, proyectoId) {
    return cambiarTareas(interaction, proyectoId, true);
  },

  async 'select:tarea-reabrir'(interaction, proyectoId) {
    return cambiarTareas(interaction, proyectoId, false);
  },

  async 'modal:tarea-extra'(interaction) {
    const p = proyectoPorCanalExtra(interaction.channelId);
    if (!p) throw new UserError(NO_EN_BD);
    if (!visible(interaction, p.id)) throw new UserError('Solo los miembros del proyecto pueden agregar tareas.');
    if (!avance(p).enProduccion) throw new UserError('Las tareas extra solo se agregan con el proyecto en producción.');
    const f = interaction.fields;
    await interaction.deferReply(ephemeral);
    const t = await agregarTareaExtra(interaction.guild, p, {
      titulo: f.getTextInputValue('titulo').trim(),
      tipo: f.getStringSelectValues('tipo')?.[0] ?? 'tarea',
      detalle: f.getTextInputValue('detalle')?.trim(),
      autor: interaction.user.id,
    });
    await refrescarFicha(interaction.guild, p);
    return interaction.editReply(`🧩 Agregada: **${t.titulo}**`);
  },

  async 'modal:video-crear'(interaction) {
    const f = interaction.fields;
    await interaction.deferReply(ephemeral);
    const { hilo } = await crearVideo(interaction.guild, interaction.user.id, {
      nombre: f.getTextInputValue('nombre').trim(),
      descripcion: f.getTextInputValue('descripcion').trim(),
      referencia: f.getTextInputValue('referencia').trim(),
      drive: f.getTextInputValue('drive')?.trim(),
    });
    return interaction.editReply(`🎬 Idea de video creada: <#${hilo.id}>. Cuando esté listo, súbelo con el botón ☁️ de la publicación.`);
  },

  async 'boton:video-drive'(interaction, id) {
    const v = videoPorId(id);
    if (!v) throw new UserError('No encuentro esa idea de video en la base de datos del bot.');
    return interaction.showModal(modalDrive(v));
  },

  async 'modal:video-drive'(interaction, id) {
    const v = videoPorId(id);
    if (!v) throw new UserError('No encuentro esa idea de video en la base de datos del bot.');
    await interaction.deferReply(ephemeral);
    await subirDrive(interaction.guild, interaction.user.id, v, interaction.fields.getTextInputValue('drive').trim());
    return interaction.editReply(`✅ Drive guardado en **${v.nombre}**; quedó marcado como listo.`);
  },

  async 'modal:idea-base'(interaction) {
    await interaction.deferReply(ephemeral);
    const { idea } = await publicarIdea(interaction.guild, interaction.member ?? interaction.user, {
      titulo: interaction.fields.getTextInputValue('nombre').trim(),
      descripcion: interaction.fields.getTextInputValue('descripcion').trim(),
    });
    return interaction.editReply(`💡 Idea **#${idea.id}** publicada. Con ${VOTOS_NECESARIOS} ${SI} pasa a ${mencion(interaction.guild, 'ideasAprobadas')}; con ${VOTOS_NECESARIOS} ${NO} se descarta.`);
  },

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
    const idea = ideaId && getDb().ideas.find((i) => String(i.id) === ideaId && !i.proyecto);
    // Si viene de una idea, su publicación en el foro se reutiliza (vincularTarjeta) en vez de crear otra.
    const { p, github } = await crearProyecto(interaction.guild, interaction.user.id, datos, idea ? { idea, tarjeta: false } : {});
    if (p.drive) {
      await registrarLink(interaction.guild, { url: p.drive, titulo: `Carpeta de ${p.nombre}`, proyecto: p.id, autor: interaction.user.id }).catch(() => {});
    }
    if (idea) {
      idea.proyecto = p.id;
      save();
      await vincularTarjeta(interaction.guild, idea, p);
    }
    let listo = `✅ Proyecto **${p.nombre}** creado: <#${p.channelId}> · rol <@&${p.roleId}> · ${p.miembros.length} miembro(s)`;
    if (p.errorRepo) listo += `\n⚠️ No se creó el repo: ${p.errorRepo}.\nCuando lo corrijas, usa \`/proyecto preparar-repo\` en el chat del proyecto.`;
    if (p.github && !github.ok) return interaction.editReply({ content: `${listo}\n\nFalta un paso para recibir los commits:`, embeds: [instrucciones(p)] });
    return interaction.editReply(listo);
  },

  async 'modal:proyecto-miembros'(interaction, id) {
    const p = proyectoDeComponente(interaction, id);
    await interaction.deferReply(ephemeral);
    const equipo = await sincronizarMiembros(interaction.guild, p, miembrosElegidos(interaction.fields));
    const { agregar, quitar } = equipo;
    await refrescarFicha(interaction.guild, p);
    await refrescarTarjetaDeProyecto(interaction.guild, p.id);
    await avisarGithub(interaction.guild, p, equipo);
    if (agregar.length) {
      const chat = await interaction.guild.channels.fetch(p.channelId).catch(() => null);
      await chat?.send(`👋 Bienvenidos al proyecto ${agregar.map((m) => `<@${m}>`).join(' ')}`);
    }
    return interaction.editReply([
      `👥 Miembros de **${p.nombre}** actualizados: +${agregar.length} / −${quitar.length}`,
      equipo.invitados.length ? `📨 Invitados al repo: ${equipo.invitados.map((m) => `<@${m}>`).join(' ')}` : '',
      equipo.sinGithub.length ? `🔗 Sin GitHub vinculado (se les invitará al vincularlo): ${equipo.sinGithub.map((m) => `<@${m}>`).join(' ')}` : '',
    ].filter(Boolean).join('\n'));
  },

  async 'modal:proyecto-editar'(interaction, id) {
    const p = proyectoDeComponente(interaction, id);
    const f = interaction.fields;
    const { github, drive } = leerLinks(f);
    p.descripcion = f.getTextInputValue('descripcion').trim();
    const repoNuevo = github && github !== p.github;
    p.github = github;
    if (repoNuevo) {
      p.githubConectado = false;
      reiniciarIssues(p);
    }
    const driveNuevo = drive && drive !== p.drive;
    p.drive = drive;
    save();
    await interaction.deferReply(ephemeral);
    if (driveNuevo) await registrarLink(interaction.guild, { url: drive, titulo: `Carpeta de ${p.nombre}`, proyecto: p.id, autor: interaction.user.id });
    if (repoNuevo) {
      await sincronizarIssues(interaction.guild, p).catch((e) => console.error(`Issues de ${p.id}:`, e.message));
      await refrescarTablero(interaction.guild, p, 'extra').catch(() => {});
      const { ok } = await conectarGithub(interaction.guild, p);
      await refrescarFicha(interaction.guild, p);
      if (!ok) return interaction.editReply({ content: `✏️ **${p.nombre}** actualizado. Conecta el nuevo repo:`, embeds: [instrucciones(p)] });
    }
    await refrescarFicha(interaction.guild, p);
    await refrescarTarjetaDeProyecto(interaction.guild, p.id);
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

// Marcar o reabrir tareas desde los menús del tablero (solo miembros del proyecto).
async function cambiarTareas(interaction, proyectoId, hecha) {
  const p = getDb().proyectos[proyectoId];
  if (!p) throw new UserError(NO_EN_BD);
    if (!visible(interaction, p.id)) throw new UserError('Solo los miembros del proyecto pueden cambiar tareas.');
  await interaction.deferReply(ephemeral);
  const cambiadas = await marcar(interaction.guild, p, interaction.values, interaction.user.id, hecha);
  await refrescarFicha(interaction.guild, p);
  return interaction.editReply(`${hecha ? '✅ Realizadas' : '↩️ Reabiertas'}: ${cambiadas.map((t) => `**${t.titulo}**`).join(', ') || 'ninguna'}`);
}

export async function handleComponent(interaction) {
  const tipo = interaction.isModalSubmit() ? 'modal' : interaction.isStringSelectMenu() ? 'select' : 'boton';
  const [accion, ...args] = interaction.customId.split(':');
  const handler = componentes[`${tipo}:${accion}`];
  if (!handler) return;
  try {
    await handler(interaction, ...args);
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
