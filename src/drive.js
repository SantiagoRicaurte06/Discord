// Detección de links de Google Drive / Docs.
const DRIVE_RE = /https?:\/\/(?:drive|docs)\.google\.com\/[^\s<>)]+/gi;

export const extractDriveLinks = (text = '') => [...new Set(text.match(DRIVE_RE) ?? [])];

export const isDriveLink = (url) => /^https?:\/\/(?:drive|docs)\.google\.com\//i.test(url);

export function driveTipo(url) {
  if (/\/folders\//.test(url)) return '📁 Carpeta';
  if (/\/document\//.test(url)) return '📄 Documento';
  if (/\/spreadsheets\//.test(url)) return '📊 Hoja de cálculo';
  if (/\/presentation\//.test(url)) return '📽️ Presentación';
  if (/\/forms\//.test(url)) return '📝 Formulario';
  return '📎 Archivo';
}
