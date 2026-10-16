// Llamadas a la API de GitHub que hace el bot con GITHUB_PAT:
// crear el repo de cada proyecto e invitar / quitar colaboradores.
// Los issues no se tocan: solo se leen (ver tareas.js).
import { parseRepo } from './github.js';

const API = 'https://api.github.com';

export const githubConfigurado = () => Boolean(process.env.GITHUB_PAT);

async function api(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'discord-organizador',
      Authorization: `Bearer ${process.env.GITHUB_PAT}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, datos };
}

let dueñoCache;
// Cuenta (usuario u organización) donde se crean los repos: GITHUB_OWNER o el dueño del token.
async function dueño() {
  if (dueñoCache) return dueñoCache;
  const { ok, status, datos } = await api('/user');
  if (!ok) throw new Error(status === 401 ? 'el GITHUB_PAT es inválido o venció' : `GitHub respondió ${status} al leer el dueño del token`);
  const login = process.env.GITHUB_OWNER || datos.login;
  dueñoCache = {
    login, esOrg: login.toLowerCase() !== datos.login.toLowerCase(), usuario: datos.login, id: datos.id, nombre: datos.name,
  };
  return dueñoCache;
}

// Identidad para los commits del bot: GIT_AUTOR_NOMBRE/GIT_AUTOR_EMAIL, o el dueño del GITHUB_PAT
// con su correo privado de GitHub (así el commit aparece con su usuario y su foto).
export async function identidadGit() {
  if (process.env.GIT_AUTOR_NOMBRE && process.env.GIT_AUTOR_EMAIL) {
    return { nombre: process.env.GIT_AUTOR_NOMBRE, email: process.env.GIT_AUTOR_EMAIL };
  }
  const d = await dueño();
  return {
    nombre: process.env.GIT_AUTOR_NOMBRE || d.nombre || d.usuario,
    email: process.env.GIT_AUTOR_EMAIL || `${d.id}+${d.usuario}@users.noreply.github.com`,
  };
}

// Crea el repo (con README inicial). Si ya existe uno con ese nombre en la cuenta, lo reutiliza.
export async function crearRepo(nombre, descripcion) {
  const { login, esOrg } = await dueño();
  const privado = process.env.GITHUB_REPO_PRIVADO !== 'false';
  const res = await api(esOrg ? `/orgs/${login}/repos` : '/user/repos', {
    method: 'POST',
    body: { name: nombre, description: descripcion.slice(0, 350), private: privado, auto_init: true, has_issues: true },
  });
  if (res.ok) return { url: res.datos.html_url, creado: true };
  if (res.status === 422) {
    const existente = await api(`/repos/${login}/${nombre}`);
    if (existente.ok) return { url: existente.datos.html_url, creado: false };
  }
  if (res.status === 403) {
    throw new Error(esOrg
      ? `el GITHUB_PAT no puede crear repos en la organización ${login}: dale acceso a la organización con Administration: Read and write`
      : 'el GITHUB_PAT no puede crear repos (403): en el token usa "All repositories" y Administration: Read and write, o un token clásico con el scope repo');
  }
  if (res.status === 401) throw new Error('el GITHUB_PAT es inválido o venció');
  throw new Error(`GitHub no creó el repo (${res.status}${res.datos?.message ? `: ${res.datos.message}` : ''})`);
}

// Invita como colaborador con permiso de escritura. GitHub envía la invitación por correo y notificación.
export async function invitar(repoUrl, login) {
  const repo = parseRepo(repoUrl);
  if (!repo || !githubConfigurado()) return { ok: false, motivo: 'sin GITHUB_PAT' };
  const res = await api(`/repos/${repo.owner}/${repo.repo}/collaborators/${encodeURIComponent(login)}`, {
    method: 'PUT', body: { permission: 'push' },
  });
  // 201 = invitación enviada, 204 = ya era colaborador
  return { ok: res.ok, yaEra: res.status === 204, motivo: res.ok ? null : `GitHub respondió ${res.status}` };
}

// Quita al colaborador y cancela su invitación si todavía no la aceptó.
export async function quitarAcceso(repoUrl, login) {
  const repo = parseRepo(repoUrl);
  if (!repo || !githubConfigurado()) return { ok: false };
  const base = `/repos/${repo.owner}/${repo.repo}`;
  await api(`${base}/collaborators/${encodeURIComponent(login)}`, { method: 'DELETE' });
  const invitaciones = await api(`${base}/invitations`);
  for (const inv of invitaciones.ok ? invitaciones.datos : []) {
    if (inv.invitee?.login?.toLowerCase() === login.toLowerCase()) await api(`${base}/invitations/${inv.id}`, { method: 'DELETE' });
  }
  return { ok: true };
}

// ---------- Inicio de sesión con GitHub (Device Flow) ----------
// La persona abre github.com/login/device, escribe el código y autoriza; el bot obtiene un token
// solo para leer su usuario (/user) y lo descarta. Requiere una OAuth App con "Device Flow" activado
// y su Client ID en GITHUB_CLIENT_ID. No necesita URL pública ni client secret.

export const loginConfigurado = () => Boolean(process.env.GITHUB_CLIENT_ID);

async function postGithub(ruta, cuerpo) {
  const res = await fetch(`https://github.com${ruta}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'discord-organizador' },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, ...cuerpo }),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok && !datos.error) throw new Error(`GitHub respondió ${res.status}`);
  return datos;
}

// Pide un código para que la persona lo ingrese en github.com/login/device.
export async function iniciarLogin() {
  const d = await postGithub('/login/device/code', { scope: '' });
  if (d.error) throw new Error(d.error_description ?? d.error);
  return {
    codigo: d.user_code, url: d.verification_uri, deviceCode: d.device_code,
    intervalo: (d.interval ?? 5) * 1000, expiraEn: Date.now() + (d.expires_in ?? 900) * 1000,
  };
}

const esperar = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Espera a que la persona autorice y devuelve su usuario de GitHub (o lanza error si cancela o vence).
export async function esperarLogin({ deviceCode, intervalo, expiraEn }) {
  let pausa = intervalo;
  while (Date.now() < expiraEn) {
    await esperar(pausa);
    const t = await postGithub('/login/oauth/access_token', {
      device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (t.access_token) {
      const res = await fetch(`${API}/user`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'discord-organizador', Authorization: `Bearer ${t.access_token}` },
      });
      if (!res.ok) throw new Error(`GitHub respondió ${res.status} al leer el usuario`);
      return (await res.json()).login;
    }
    if (t.error === 'slow_down') pausa += 5000;
    else if (t.error === 'access_denied') throw new Error('Cancelaste la autorización en GitHub.');
    else if (t.error === 'expired_token') break;
    else if (t.error !== 'authorization_pending') throw new Error(t.error_description ?? t.error);
  }
  throw new Error('El código venció. Vuelve a usar /github vincular.');
}
