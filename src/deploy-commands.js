// Registra los slash commands. Con GUILD_ID se aplican al instante en ese servidor.
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Faltan DISCORD_TOKEN y/o CLIENT_ID en .env');
  process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);
const body = commands.map((c) => c.toJSON());
const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);

await rest.put(route, { body });
console.log(`✅ ${body.length} comandos registrados ${GUILD_ID ? `en el servidor ${GUILD_ID}` : 'globalmente (puede tardar hasta 1h)'}`);
