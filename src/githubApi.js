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
  const { ok, datos } = await api('/user');
  if (!ok) throw new Error('GITHUB_PAT inválido');
  const login = process.env.GITHUB_OWNER || datos.login;
  dueñoCache = { login, esOrg: login.toLowerCase() !== datos.login.toLowerCase() };
  return dueñoCache;
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
  throw new Error(`GitHub no creó el repo (${res.status}${res.datos?.message ? `: ${res.datos.message}` : ''})`);
}

export async function existeUsuario(login) {
  const res = await (githubConfigurado()
    ? api(`/users/${encodeURIComponent(login)}`)
    : fetch(`${API}/users/${encodeURIComponent(login)}`, { headers: { 'User-Agent': 'discord-organizador' } })
      .then(async (r) => ({ ok: r.ok, status: r.status, datos: await r.json().catch(() => null) })));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
  return { login: res.datos.login, url: res.datos.html_url };
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
