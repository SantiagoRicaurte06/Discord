// Crea la estructura del servidor sin pasar por /setup: npm run setup
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { setupServer } from './commands/index.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(process.env.DISCORD_TOKEN);
await new Promise((r) => client.once('clientReady', r));
const guild = await client.guilds.fetch(process.env.GUILD_ID);
await guild.channels.fetch();
const creados = await setupServer(guild);
console.log(creados.length ? `✅ Canales creados: ${creados.join(', ')}` : '✅ La estructura ya existía');
await client.destroy();
