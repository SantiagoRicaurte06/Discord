// Ideas: /idea-base publica una idea en 💡・ideas con ✅ y ❌.
// Con VOTOS_NECESARIOS ❌ se elimina; con VOTOS_NECESARIOS ✅ el bot crea el proyecto (canales, rol y repo de GitHub)
// con el responsable por defecto (RESPONSABLE_ID o el dueño del servidor) y lo publica en el foro de proyectos aprobados.
// Las reacciones del bot no cuentan.
import {
  EmbedBuilder, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import {
  getDb, addIdea, save, slug,
} from './store.js';
import { COLORES, canal } from './layout.js';
import { publicarTarjeta } from './tarjetas.js';

export const VOTOS_NECESARIOS = 3;
export const SI = '✅';
export const NO = '❌';

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

function ideaEmbed(idea) {
  return new EmbedBuilder().setColor(COLORES.ideas)
    .setTitle(`💡 ${idea.titulo}`)
    .setDescription(idea.descripcion)
    .addFields({ name: 'Votación', value: `${SI} ${VOTOS_NECESARIOS} votos la aprueban · ${NO} ${VOTOS_NECESARIOS} votos la descartan` })
    .setFooter({ text: `Idea #${idea.id}` })
    .setTimestamp(new Date(idea.fecha));
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
  save();
  // Si el proyecto se crea, su publicación en el foro la hace crearProyecto; si falla, se publica la idea sola.
  const ok = await crearProyectoDeIdea(guild, idea);
  if (!ok) await publicarTarjeta(guild, { idea });
}

// Crea el proyecto de una idea aprobada, con el responsable por defecto como único miembro inicial.
async function crearProyectoDeIdea(guild, idea) {
  const { crearProyecto } = await import('./proyectos.js');
  const responsable = process.env.RESPONSABLE_ID || guild.ownerId;
  const nombre = getDb().proyectos[slug(idea.titulo)] ? `${idea.titulo} ${idea.id}` : idea.titulo;
  try {
    const { p } = await crearProyecto(guild, responsable, { nombre, descripcion: idea.descripcion.slice(0, 1000) }, { idea });
    idea.proyecto = p.id;
    save();
    return true;
  } catch (err) {
    idea.errorProyecto = err.message;
    save();
    console.error(`No se pudo crear el proyecto de la idea #${idea.id}:`, err);
    return false;
  }
}
