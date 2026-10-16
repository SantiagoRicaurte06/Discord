// Ideas: /idea-base publica una idea en 💡・ideas con ✅ y ❌.
// Con VOTOS_NECESARIOS ❌ se elimina; con VOTOS_NECESARIOS ✅ pasa a proyectos aprobados y el bot crea
// el proyecto (canales, rol y repo de GitHub) con el responsable por defecto (RESPONSABLE_ID o el dueño del servidor).
// Las reacciones del bot no cuentan.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, LabelBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} from 'discord.js';
import {
  getDb, addIdea, save, slug,
} from './store.js';
import { COLORES, canal } from './layout.js';

export const VOTOS_NECESARIOS = 3;
export const SI = '✅';
export const NO = '❌';

export const ETAPAS = { pendiente: '⏳ Por iniciar', desarrollo: '🛠️ Desarrollo', produccion: '🚀 Producción' };

// Avance según los issues de GitHub del proyecto: % cerrados y etapa (Producción cuando no queda ninguno abierto).
export function avance(p) {
  if (!p) return { etapa: ETAPAS.pendiente, pct: 0, hechas: 0, total: 0 };
  const issues = (p.tareas ?? []).filter((t) => t.origen === 'github');
  const hechas = issues.filter((t) => t.estado === 'hecha').length;
  const total = issues.length;
  const pct = total ? Math.round((hechas / total) * 100) : 0;
  return { etapa: total && hechas === total ? ETAPAS.produccion : ETAPAS.desarrollo, pct, hechas, total };
}

export const modalIdea = () => new ModalBuilder()
  .setCustomId('idea-base')
  .setTitle('Nueva idea')
  .addLabelComponents(
    new LabelBuilder().setLabel('Nombre').setTextInputComponent(
      new TextInputBuilder().setCustomId('nombre').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80),
    ),
    new LabelBuilder().setLabel('Descripción').setTextInputComponent(
      new TextInputBuilder().setCustomId('descripcion').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500),
    ),
  );

export function barra(pct, largo = 10) {
  const llenos = Math.round((Math.max(0, Math.min(100, pct)) / 100) * largo);
  return `${'▰'.repeat(llenos)}${'▱'.repeat(largo - llenos)} **${pct}%**`;
}

function ideaEmbed(idea) {
  return new EmbedBuilder().setColor(COLORES.ideas)
    .setTitle(`💡 ${idea.titulo}`)
    .setDescription(idea.descripcion)
    .addFields({ name: 'Votación', value: `${SI} ${VOTOS_NECESARIOS} votos la aprueban · ${NO} ${VOTOS_NECESARIOS} votos la descartan` })
    .setFooter({ text: `Idea #${idea.id}` })
    .setTimestamp(new Date(idea.fecha));
}

function aprobadaContenido(idea) {
  const p = idea.proyecto ? getDb().proyectos[idea.proyecto] : null;
  let equipo = '*Sin proyecto — usa el botón para crearlo*';
  if (p) equipo = p.miembros.map((m) => `<@${m}>`).join(' ') || '—';
  const a = avance(p);
  let detalle = 'Se calcula con los issues de GitHub cuando se cree el proyecto.';
  if (p) detalle = a.total ? `${a.hechas}/${a.total} issues cerrados` : 'El repositorio aún no tiene issues.';
  const embed = new EmbedBuilder().setColor(a.etapa === ETAPAS.produccion ? COLORES.primario : COLORES.exito)
    .setTitle(`◆ ${idea.titulo}`)
    .setDescription(idea.descripcion)
    .addFields(
      { name: 'Estado', value: a.etapa, inline: true },
      { name: '⭐ Responsable', value: p ? `<@${p.autor}>` : '—', inline: true },
      { name: 'Propuesta por', value: `<@${idea.autor}>`, inline: true },
      { name: '🐙 Repositorio', value: p?.github ?? (p?.errorRepo ? `⚠️ ${p.errorRepo}` : '—'), inline: true },
      { name: 'Aprobada con', value: `${SI} ${idea.votosSi}`, inline: true },
      { name: `👥 Equipo${p ? ` (${p.miembros.length})` : ''}`, value: equipo },
      { name: 'Progreso', value: `${barra(a.pct)}\n-# ${detalle}` },
    )
    .setFooter({ text: `Idea #${idea.id} · aprobada${p ? ` · proyecto ${p.nombre}` : ''}` })
    .setTimestamp(new Date(idea.aprobadaEn));
  // Con proyecto: el responsable asigna el equipo desde aquí. Sin proyecto (falló la creación): botón para crearlo a mano.
  const boton = p
    ? new ButtonBuilder().setCustomId(`proyecto-miembros:${p.id}`).setLabel('Asignar equipo').setEmoji('👥').setStyle(ButtonStyle.Primary)
    : new ButtonBuilder().setCustomId(`idea-proyecto:${idea.id}`).setLabel('Crear proyecto').setEmoji('🚀').setStyle(ButtonStyle.Success);
  const components = [new ActionRowBuilder().addComponents(boton)];
  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

// Actualiza la tarjeta en proyectos aprobados (equipo, estado, progreso).
export async function refrescarAprobada(guild, idea) {
  const destino = canal(guild, 'ideasAprobadas');
  const msg = idea.aprobadaMessageId && await destino?.messages.fetch(idea.aprobadaMessageId).catch(() => null);
  await msg?.edit(aprobadaContenido(idea)).catch(() => {});
}

export async function refrescarAprobadasDeProyecto(guild, proyectoId) {
  for (const idea of getDb().ideas.filter((i) => i.proyecto === proyectoId)) await refrescarAprobada(guild, idea);
}

export async function publicarIdea(guild, autor, { titulo, descripcion }) {
  const destino = canal(guild, 'ideas');
  const id = addIdea({ titulo, descripcion, autor: autor.id, estado: 'votacion' });
  const idea = getDb().ideas.find((i) => i.id === id);
  const msg = await destino.send({
    embeds: [ideaEmbed(idea).setAuthor({ name: autor.displayName, iconURL: autor.displayAvatarURL() })],
  });
  await msg.react(SI);
  await msg.react(NO);
  idea.messageId = msg.id;
  idea.channelId = destino.id;
  save();
  return { idea, msg };
}

const procesando = new Set();

// Llamado en cada reacción del canal de ideas.
export async function procesarVoto(reaction, user) {
  if (user.bot) return;
  const idea = getDb().ideas.find((i) => i.messageId === reaction.message.id && i.estado === 'votacion');
  if (!idea) return;

  const emoji = reaction.emoji.name;
  if (emoji !== SI && emoji !== NO) {
    await reaction.remove().catch(() => {});
    return;
  }

  const msg = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  await evaluar(msg, idea);
}

// Cuenta los votos (sin bots) y aprueba o descarta la idea si llegó al mínimo.
async function evaluar(msg, idea) {
  if (procesando.has(idea.id)) return;
  procesando.add(idea.id);
  try {
    const contar = async (e) => {
      const r = msg.reactions.cache.find((x) => x.emoji.name === e);
      if (!r) return 0;
      const usuarios = await r.users.fetch();
      return usuarios.filter((u) => !u.bot).size;
    };
    const [si, no] = [await contar(SI), await contar(NO)];
    if (no >= VOTOS_NECESARIOS) {
      idea.estado = 'descartada';
      idea.votosNo = no;
      save();
      await msg.delete().catch(() => {});
    } else if (si >= VOTOS_NECESARIOS) {
      await aprobar(msg.guild, idea, si);
      await msg.delete().catch(() => {});
    }
  } finally {
    procesando.delete(idea.id);
  }
}

// Al arrancar: revisa las ideas en votación por si hubo votos mientras el bot estaba apagado.
export async function revisarVotacionesPendientes(guild) {
  for (const idea of getDb().ideas.filter((i) => i.estado === 'votacion' && i.messageId)) {
    const ch = await guild.channels.fetch(idea.channelId).catch(() => null);
    const msg = await ch?.messages.fetch(idea.messageId).catch(() => null);
    if (!msg) {
      idea.estado = 'eliminada';
      save();
      continue;
    }
    await evaluar(msg, idea).catch((e) => console.error(`Votos de la idea #${idea.id}:`, e.message));
  }
}

export async function aprobar(guild, idea, votosSi) {
  Object.assign(idea, {
    estado: 'aprobada', votosSi, aprobadaEn: new Date().toISOString(),
  });
  await crearProyectoDeIdea(guild, idea);
  const destino = canal(guild, 'ideasAprobadas');
  const msg = await destino?.send(aprobadaContenido(idea));
  idea.aprobadaMessageId = msg?.id;
  save();
}

// Crea el proyecto de una idea aprobada, con el responsable por defecto como único miembro inicial.
async function crearProyectoDeIdea(guild, idea) {
  const { crearProyecto } = await import('./proyectos.js');
  const responsable = process.env.RESPONSABLE_ID || guild.ownerId;
  const nombre = getDb().proyectos[slug(idea.titulo)] ? `${idea.titulo} ${idea.id}` : idea.titulo;
  try {
    const { p } = await crearProyecto(guild, responsable, { nombre, descripcion: idea.descripcion.slice(0, 1000) });
    idea.proyecto = p.id;
  } catch (err) {
    idea.errorProyecto = err.message;
    console.error(`No se pudo crear el proyecto de la idea #${idea.id}:`, err);
  }
  save();
}
