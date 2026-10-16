import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import {
  handleCommand, handleAutocomplete, handleComponent, registrarLink,
} from './commands/index.js';
import { extractDriveLinks } from './drive.js';
import { findProyectoByChannel, getDb, save } from './store.js';
import { refrescarFicha } from './proyectos.js';
import { procesarVoto } from './ideas.js';
import { iniciarSincronizacion } from './tareas.js';
import { guardarArchivo, asignarRespaldo, archivoPorMensaje } from './carpetas.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('Falta DISCORD_TOKEN en .env');
  process.exit(1);
}

const BASE_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions];
// MessageContent requiere activar "Message Content Intent" en el Developer Portal.
const FULL_INTENTS = [...BASE_INTENTS, GatewayIntentBits.MessageContent];

function createClient(intents) {
  const client = new Client({ intents, partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User] });
  registerEvents(client);
  return client;
}

function registerEvents(client) {
  client.once(Events.ClientReady, (c) => {
    console.log(`✅ Conectado como ${c.user.tag} en ${c.guilds.cache.size} servidor(es)`);
    if (process.env.GUILD_ID) iniciarSincronizacion(c, process.env.GUILD_ID);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) return handleCommand(interaction);
    if (interaction.isAutocomplete()) return handleAutocomplete(interaction);
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) return handleComponent(interaction);
  });

  // Votación de ideas.
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (reaction.partial) await reaction.fetch();
      await procesarVoto(reaction, user);
    } catch (err) {
      console.error('Error procesando voto:', err);
    }
  });

  // Registro automático de links de Drive y archivos subidos.
  client.on(Events.MessageCreate, async (message) => {
    // El primer aviso de GitHub que llega al canal de commits confirma la conexión.
    if (message.webhookId && message.guild) {
      const p = Object.values(getDb().proyectos).find((x) => x.commitsId === message.channelId);
      if (p && !p.githubConectado) {
        p.githubConectado = true;
        save();
        await refrescarFicha(message.guild, p).catch(() => {});
      }
    }
    if (message.author.bot || !message.guild) return;
    const { guild } = message;
    const parentId = message.channel.isThread() ? message.channel.parentId : message.channelId;
    const proyecto = findProyectoByChannel(parentId);

    try {
      let registrado = false;
      for (const url of extractDriveLinks(message.content)) {
        const ok = await registrarLink(guild, {
          url, titulo: 'Link compartido', proyecto: proyecto?.id, autor: message.author.id, origen: message.url,
        });
        registrado ||= ok;
      }
      if (registrado) await message.react('📎');

      // Archivos subidos en el chat de un proyecto → su carpeta de archivos.
      if (proyecto && message.attachments.size) {
        const drive = extractDriveLinks(message.content)[0];
        for (const attachment of message.attachments.values()) {
          await guardarArchivo(guild, { attachment, drive, proyecto: proyecto.id, autor: message.author.id, origen: message.url });
        }
        await message.react('🗂️');
      }

      // Responder a un archivo dentro de una carpeta con un link de Drive = asignar respaldo.
      const respondido = message.reference?.messageId && archivoPorMensaje(message.reference.messageId);
      const drive = extractDriveLinks(message.content)[0];
      if (respondido && drive) {
        await asignarRespaldo(guild, respondido, drive);
        await message.react('☁️');
      }
    } catch (err) {
      console.error('Error procesando mensaje:', err);
    }
  });
}

try {
  await createClient(FULL_INTENTS).login(process.env.DISCORD_TOKEN);
} catch (err) {
  if (!/disallowed intents/i.test(err.message)) throw err;
  console.warn('⚠️ Message Content Intent desactivado: los slash commands funcionan, pero no se registrarán'
    + ' automáticamente los links de Drive ni los archivos. Actívalo en Developer Portal > Bot.');
  await createClient(BASE_INTENTS).login(process.env.DISCORD_TOKEN);
}

