// Ideas: /idea-base publica una idea en 💡・ideas con ✅ y ❌.
// Con VOTOS_NECESARIOS ❌ se elimina; con VOTOS_NECESARIOS ✅ pasa a proyectos aprobados.
// Las reacciones del bot no cuentan.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, LabelBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getDb, addIdea, save } from './store.js';
import { COLORES, canal } from './layout.js';

export const VOTOS_NECESARIOS = 3;
export const SI = '✅';
export const NO = '❌';

// Por ahora fijos; luego se configuran por proyecto.
const ETAPA_INICIAL = '🛠️ Desarrollo';
const PROGRESO_INICIAL = 0;

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
  const equipo = p?.miembros.length
    ? p.miembros.map((m) => `<@${m}>`).join(' ')
    : '*Sin asignar — crea el proyecto con el botón para asignar el equipo*';
  const embed = new EmbedBuilder().setColor(COLORES.exito)
    .setTitle(`◆ ${idea.titulo}`)
    .setDescription(idea.descripcion)
    .addFields(
      { name: 'Estado', value: idea.etapa, inline: true },
      { name: 'Propuesta por', value: `<@${idea.autor}>`, inline: true },
      { name: 'Aprobada con', value: `${SI} ${idea.votosSi}`, inline: true },
      { name: `👥 Equipo${p ? ` (${p.miembros.length})` : ''}`, value: equipo },
      { name: 'Progreso', value: barra(idea.progreso) },
    )
    .setFooter({ text: `Idea #${idea.id} · aprobada${p ? ` · proyecto ${p.nombre}` : ''}` })
    .setTimestamp(new Date(idea.aprobadaEn));
  const components = p ? [] : [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`idea-proyecto:${idea.id}`).setLabel('Crear proyecto').setEmoji('🚀').setStyle(ButtonStyle.Success),
  )];
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
  if (!idea || procesando.has(idea.id)) return;

  const emoji = reaction.emoji.name;
  if (emoji !== SI && emoji !== NO) {
    await reaction.remove().catch(() => {});
    return;
  }

  procesando.add(idea.id);
  try {
    const msg = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
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

async function aprobar(guild, idea, votosSi) {
  Object.assign(idea, {
    estado: 'aprobada', votosSi, etapa: ETAPA_INICIAL, progreso: PROGRESO_INICIAL, aprobadaEn: new Date().toISOString(),
  });
  const destino = canal(guild, 'ideasAprobadas');
  const msg = await destino?.send(aprobadaContenido(idea));
  idea.aprobadaMessageId = msg?.id;
  save();
}
