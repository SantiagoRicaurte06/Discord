// Canal de commits por proyecto: un webhook de Discord que recibe los eventos del repo de GitHub.
// Discord entiende el formato de GitHub si la URL del webhook termina en /github.
// Con GITHUB_PAT en .env el bot registra el webhook en el repo; si no, muestra los pasos para hacerlo a mano.
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { save } from './store.js';

const EVENTOS = ['push', 'pull_request', 'pull_request_review', 'issues', 'issue_comment', 'release', 'create', 'delete'];

export function parseRepo(url) {
  const m = url?.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export const webhookGithubUrl = (p) => (p.webhookUrl ? `${p.webhookUrl}/github` : null);

// Crea (si falta) el canal de commits de solo lectura y su webhook.
export async function ensureCanalCommits(guild, p) {
  let canal = p.commitsId && await guild.channels.fetch(p.commitsId).catch(() => null);
  if (!canal) {
    canal = await guild.channels.create({
      name: `commits-${p.id}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: p.categoryId,
      topic: `Commits, PRs, issues y releases de ${p.github ?? 'GitHub'}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: p.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageWebhooks] },
      ],
    });
    p.commitsId = canal.id;
    p.webhookUrl = null;
  }
  if (!p.webhookUrl) {
    const hook = await canal.createWebhook({ name: 'GitHub', reason: `Commits de ${p.nombre}` });
    p.webhookUrl = hook.url;
  }
  save();
  return canal;
}

// Registra el webhook en el repo usando la API de GitHub (necesita GITHUB_PAT con permiso de webhooks).
async function registrarEnGithub(p) {
  const token = process.env.GITHUB_PAT;
  const repo = parseRepo(p.github);
  if (!token || !repo) return { ok: false, motivo: token ? 'link de repo inválido' : 'sin GITHUB_PAT' };

  const api = `https://api.github.com/repos/${repo.owner}/${repo.repo}/hooks`;
  const headers = {
    Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'discord-organizador',
  };
  const existentes = await fetch(api, { headers }).then((r) => (r.ok ? r.json() : []));
  if (existentes.some?.((h) => h.config?.url === webhookGithubUrl(p))) return { ok: true };

  const res = await fetch(api, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'web', active: true, events: EVENTOS,
      config: { url: webhookGithubUrl(p), content_type: 'json' },
    }),
  });
  if (!res.ok) return { ok: false, motivo: `GitHub respondió ${res.status}` };
  p.githubHookId = (await res.json()).id;
  save();
  return { ok: true };
}

export function instrucciones(p) {
  const repo = parseRepo(p.github);
  const ajustes = repo ? `https://github.com/${repo.owner}/${repo.repo}/settings/hooks/new` : 'tu repositorio → Settings → Webhooks → Add webhook';
  return new EmbedBuilder().setColor(0x24292f).setTitle(`🐙 Conectar GitHub · ${p.nombre}`).setDescription([
    `1. Abre ${ajustes}`,
    '2. **Payload URL:** copia la URL de abajo (es secreta, no la compartas)',
    '3. **Content type:** `application/json`',
    '4. **Which events?** → *Send me everything* o elige Pushes, Pull requests, Issues, Releases',
    '5. Pulsa **Add webhook**',
    '',
    `Los commits llegarán a <#${p.commitsId}>.`,
    '',
    `\`\`\`${webhookGithubUrl(p)}\`\`\``,
  ].join('\n'));
}

// Prepara el canal y trata de conectar el repo. Devuelve si quedó conectado automáticamente.
export async function conectarGithub(guild, p) {
  const canal = await ensureCanalCommits(guild, p);
  const resultado = p.github ? await registrarEnGithub(p).catch((e) => ({ ok: false, motivo: e.message })) : { ok: false, motivo: 'sin repo' };
  p.githubConectado = resultado.ok;
  save();
  if (resultado.ok) {
    await canal.send(`✅ Conectado a ${p.github}. Aquí llegarán los commits, PRs, issues y releases.`).catch(() => {});
  }
  return { canal, ...resultado };
}
