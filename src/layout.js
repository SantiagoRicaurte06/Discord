// Estructura del servidor que crea /setup.
import { ChannelType } from 'discord.js';

export const LAYOUT = [
  {
    categoria: '📌 GENERAL',
    canales: [
      { nombre: 'bienvenida', tema: 'Cómo funciona este servidor y los comandos del bot' },
      { nombre: 'anuncios', tema: 'Novedades importantes' },
      { nombre: 'general', tema: 'Conversación libre' },
    ],
  },
  {
    categoria: '💡 IDEAS',
    canales: [
      { nombre: 'ideas', tema: 'Usa /idea nueva — cada idea tiene su hilo y votación 👍 👎' },
      { nombre: 'ideas-aprobadas', tema: 'Ideas que pasan a ser proyecto' },
    ],
  },
  {
    categoria: '🔗 RECURSOS',
    canales: [
      { nombre: 'links-drive', tema: 'Registro automático de todos los links de Google Drive' },
    ],
  },
];

export const FORO_ARCHIVOS = 'archivos';
export const CAT_RECURSOS = '🔗 RECURSOS';
export const VOZ = '🔊 VOZ';

export function findCategory(guild, nombre) {
  return guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === nombre);
}

export function findText(guild, nombre) {
  return guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === nombre);
}

export async function ensureCategory(guild, nombre) {
  return findCategory(guild, nombre)
    ?? guild.channels.create({ name: nombre, type: ChannelType.GuildCategory });
}
