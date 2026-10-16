import 'dotenv/config';
import { Client, GatewayIntentBits, Events, EmbedBuilder, Partials } from 'discord.js';
import { handleCommand, handleAutocomplete, registrarLink } from './commands/index.js';
import { extractDriveLinks } from './drive.js';
import { findProyectoByChannel, addArchivo } from './store.js';
import { findText } from './layout.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('Falta DISCORD_TOKEN en .env');
  process.exit(1);
}

const BASE_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
// MessageContent requiere activar "Message Content Intent" en el Developer Portal.
const FULL_INTENTS = [...BASE_INTENTS, GatewayIntentBits.MessageContent];

function createClient(intents) {
  const client = new Client({ intents, partials: [Partials.Channel] });
  registerEvents(client);
  return client;
}

function registerEvents(client) {
  client.once(Events.ClientReady, (c) => {
    console.log(`✅ Conectado como ${c.user.tag} en ${c.guilds.cache.size} servidor(es)`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) return handleCommand(interaction);
    if (interaction.isAutocomplete()) return handleAutocomplete(interaction);
  });

  // Registro automático de links de Drive y archivos subidos.
  client.on(Events.MessageCreate, async (message) => {
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

      if (proyecto && message.attachments.size) {
        const log = findText(guild, 'archivos');
        for (const a of message.attachments.values()) {
          addArchivo({ nombre: a.name, url: a.url, tamaño: a.size, proyecto: proyecto.id, autor: message.author.id, mensaje: message.url });
          await log?.send({
            embeds: [new EmbedBuilder().setColor(0xeb459e).setTitle(`📄 ${a.name}`.slice(0, 256)).setURL(message.url)
              .setDescription(`Proyecto: **${proyecto.nombre}** (<#${proyecto.channelId}>)\nSubido por <@${message.author.id}> · ${(a.size / 1024).toFixed(1)} KB`)
              .setTimestamp()],
          });
        }
        await message.react('🗂️');
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

