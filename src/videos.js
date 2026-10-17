// Ideas de videos: foro 🎬・ideas-de-videos donde solo el bot crea publicaciones.
// /idea-video abre un formulario (nombre, descripción, referencia y Drive opcional) y crea la publicación.
// Cuando el video está listo, el botón ☁️ de la publicación guarda el link de Drive y la marca como ✅ Listo.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, LabelBuilder, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getDb, save } from './store.js';
import { COLORES, canal, ensureCanal } from './layout.js';
import { isDriveLink, driveTipo } from './drive.js';
import { UserError } from './proyectos.js';

const ETIQUETA = { idea: 'Idea', listo: 'Listo' };
const esUrl = (s) => /^https?:\/\/\S+$/i.test(s);

const texto = (id, label, { style = TextInputStyle.Short, required = false, max, placeholder, value } = {}) => {
  const input = new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(required);
  if (max) input.setMaxLength(max);
  if (placeholder) input.setPlaceholder(placeholder);
  if (value) input.setValue(value);
  return new LabelBuilder().setLabel(label).setTextInputComponent(input);
};

export const modalVideo = () => new ModalBuilder().setCustomId('video-crear').setTitle('🎬 Nueva idea de video')
  .addLabelComponents(
    texto('nombre', 'Nombre del video', { required: true, max: 90 }),
    texto('descripcion', 'Descripción', { style: TextInputStyle.Paragraph, required: true, max: 2000, placeholder: 'De qué trata, formato, duración, ideas de guion…' }),
    texto('referencia', 'Link de referencia', { required: true, max: 500, placeholder: 'https://youtube.com/… o https://tiktok.com/…' }),
    texto('drive', 'Link de Drive (opcional, cuando esté listo)', { max: 500, placeholder: 'https://drive.google.com/…' }),
  );

export const modalDrive = (v) => new ModalBuilder().setCustomId(`video-drive:${v.id}`).setTitle(`☁️ Drive · ${v.nombre}`.slice(0, 45))
  .addLabelComponents(texto('drive', 'Link de Drive del video', { required: true, max: 500, placeholder: 'https://drive.google.com/…', value: v.drive ?? undefined }));

function embedVideo(v) {
  return new EmbedBuilder()
    .setColor(v.drive ? COLORES.exito : COLORES.ideas)
    .setTitle(`🎬 ${v.nombre}`)
    .setDescription(v.descripcion)
    .addFields(
      { name: 'Estado', value: v.drive ? '✅ Listo' : '💡 Idea', inline: true },
      { name: 'Propuesto por', value: `<@${v.autor}>`, inline: true },
      { name: '🔗 Referencia', value: v.referencia },
      { name: '☁️ Drive', value: v.drive ? `${driveTipo(v.drive)} · [abrir](${v.drive})${v.subidoPor ? ` · subido por <@${v.subidoPor}>` : ''}` : '— Cuando esté listo, súbelo con el botón **☁️ Subir Drive**' },
    )
    .setFooter({ text: `Video #${v.id}` })
    .setTimestamp(new Date(v.fecha));
}

function botones(v) {
  const fila = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`video-drive:${v.id}`).setLabel(v.drive ? 'Cambiar Drive' : 'Subir Drive').setEmoji('☁️')
      .setStyle(v.drive ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setURL(v.referencia).setLabel('Referencia').setEmoji('🔗').setStyle(ButtonStyle.Link),
  );
  if (v.drive) fila.addComponents(new ButtonBuilder().setURL(v.drive).setLabel('Ver en Drive').setEmoji('▶️').setStyle(ButtonStyle.Link));
  return [fila];
}

const etiquetas = (foro, v) => foro.availableTags.filter((t) => t.name === (v.drive ? ETIQUETA.listo : ETIQUETA.idea)).map((t) => t.id);

function validar({ referencia, drive }) {
  if (!esUrl(referencia)) throw new UserError('El link de referencia debe empezar con http:// o https://');
  if (drive && !isDriveLink(drive)) throw new UserError('El link de Drive debe ser de drive.google.com o docs.google.com.');
}

// Crea el foro si falta (con sus etiquetas): solo el bot publica; todos comentan y reaccionan dentro.
// Se llama al arrancar, así el foro aparece al desplegar sin correr /setup.
export async function ensureForoVideos(guild) {
  const { canal: foro, creado } = await ensureCanal(guild, 'videos');
  if (creado) {
    const P = PermissionFlagsBits;
    await foro.permissionOverwrites.set([
      { id: guild.roles.everyone.id, deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads], allow: [P.SendMessagesInThreads, P.AddReactions] },
      { id: guild.members.me.id, allow: [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.ManageThreads, P.AddReactions, P.ManageMessages] },
    ]);
  }
  return foro;
}

export async function crearVideo(guild, autor, { nombre, descripcion, referencia, drive }) {
  validar({ referencia, drive });
  const foro = await ensureForoVideos(guild);
  const db = getDb();
  db.videos ??= [];
  const v = {
    id: (db.videos.at(-1)?.id ?? 0) + 1, nombre, descripcion, referencia, drive: drive || null,
    autor, subidoPor: drive ? autor : null, fecha: new Date().toISOString(),
  };
  const hilo = await foro.threads.create({
    name: `🎬 ${nombre}`.slice(0, 100),
    message: { embeds: [embedVideo(v)], components: botones(v), allowedMentions: { parse: [] } },
    appliedTags: etiquetas(foro, v),
  });
  v.threadId = hilo.id;
  db.videos.push(v);
  save();
  return { v, hilo };
}

export const videoPorId = (id) => getDb().videos?.find((v) => String(v.id) === String(id));

export async function subirDrive(guild, usuario, v, drive) {
  validar({ referencia: v.referencia, drive });
  const nuevo = v.drive !== drive;
  v.drive = drive;
  v.subidoPor = usuario;
  save();
  const hilo = await guild.channels.fetch(v.threadId).catch(() => null);
  if (!hilo) return v;
  if (hilo.archived) await hilo.setArchived(false).catch(() => {});
  const inicio = await hilo.fetchStarterMessage().catch(() => null);
  await inicio?.edit({ embeds: [embedVideo(v)], components: botones(v), allowedMentions: { parse: [] } });
  const foro = canal(guild, 'videos');
  if (foro) await hilo.setAppliedTags(etiquetas(foro, v)).catch(() => {});
  if (nuevo) await hilo.send({ content: `☁️ <@${usuario}> subió el video: ${drive}`, allowedMentions: { parse: [] } });
  return v;
}
