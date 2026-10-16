// Prepara el repo de un proyecto con las skills del equipo y el git workflow, para que quien lo clone
// tenga todo listo sin instalar nada (Claude Code carga .claude/skills y .claude/agents del proyecto).
// Usa los scripts de este repo: skills/guia-skills/scripts/instalar.sh y skills/git-workflow/scripts/configurar.sh.
// Requiere en el servidor del bot: git, bash, Node/npx y GITHUB_PAT con permiso de escritura en el repo.
import { execFile } from 'node:child_process';
import { mkdtemp, rm, appendFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { EmbedBuilder } from 'discord.js';
import { parseRepo } from './github.js';
import { identidadGit } from './githubApi.js';
import { save } from './store.js';
import { COLORES } from './layout.js';

const ejecutar = promisify(execFile);
const SKILLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const INSTALAR = join(SKILLS, 'guia-skills', 'scripts', 'instalar.sh');
const CONFIGURAR = join(SKILLS, 'git-workflow', 'scripts', 'configurar.sh');
const MENSAJE = 'chore: add team skills and git workflow';

const NOTA_README = `
## Skills del equipo

Este repo trae las skills del equipo en \`.claude/skills/\` y sus subagentes en \`.claude/agents/\`.
Al abrirlo con Claude Code se cargan solas; la skill \`guia-skills\` decide cuál usar en cada momento.

Una sola vez después de clonar, activa los hooks de Git del equipo:

\`\`\`bash
git config core.hooksPath .githooks
\`\`\`

Normas de ramas y commits: [GIT_WORKFLOW.md](GIT_WORKFLOW.md). Actualizar las skills: \`npx skills@latest update\`.
`;

async function correr(cmd, args, cwd, timeout = 300_000) {
  try {
    return await ejecutar(cmd, args, { cwd, timeout, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  } catch (err) {
    // No mostrar el token si aparece en el error.
    const msg = `${err.stderr || err.message}`.replace(/x-access-token:[^@]+@/g, 'x-access-token:***@');
    throw new Error(`${cmd} ${args[0] ?? ''}: ${msg.trim().split('\n').slice(-3).join(' ')}`);
  }
}

// cloneUrl permite probar con un repo local; por defecto usa GitHub con el PAT.
export async function prepararRepo(repoUrl, { cloneUrl, rama = null } = {}) {
  const repo = parseRepo(repoUrl);
  if (!repo) throw new Error('Link de repo inválido');
  const url = cloneUrl ?? `https://x-access-token:${process.env.GITHUB_PAT}@github.com/${repo.owner}/${repo.repo}.git`;
  if (!cloneUrl && !process.env.GITHUB_PAT) throw new Error('Falta GITHUB_PAT');

  const dir = await mkdtemp(join(tmpdir(), 'repo-'));
  try {
    await correr('git', ['clone', '--quiet', url, dir], tmpdir());
    const base = rama ?? (await correr('git', ['symbolic-ref', '--short', 'HEAD'], dir)).stdout.trim();
    if (base !== 'main' && base !== 'master') {
      // El repo ya sigue otro modelo: se prepara sobre main si existe.
      await correr('git', ['switch', '--quiet', 'main'], dir).catch(() => {});
    }

    await correr('bash', [INSTALAR, '--instalar'], dir, 600_000);
    await correr('bash', [CONFIGURAR, '--aplicar'], dir);

    const claude = await readFile(join(dir, 'CLAUDE.md'), 'utf8').catch(() => '');
    if (!claude.includes('## Skills del equipo')) {
      await appendFile(join(dir, 'CLAUDE.md'), '\n## Skills del equipo\n\nEste repo trae las skills del equipo en `.claude/skills/`. Al empezar cada tarea, consulta `guia-skills` para decidir cuál aplicar.\n');
    }
    const readme = await readFile(join(dir, 'README.md'), 'utf8').catch(() => '');
    if (!readme.includes('## Skills del equipo')) await appendFile(join(dir, 'README.md'), NOTA_README);

    await correr('git', ['add', '-A'], dir);
    const cambios = (await correr('git', ['status', '--porcelain'], dir)).stdout.trim();
    if (!cambios) return { ok: true, sinCambios: true };
    // El commit inicial va en main: se omiten los hooks recién instalados (bloquean commits directos a main).
    const yo = await identidadGit().catch(() => ({ nombre: 'Zy', email: 'zy-bot@users.noreply.github.com' }));
    await correr('git', ['-c', 'core.hooksPath=/dev/null', '-c', `user.name=${yo.nombre}`, '-c', `user.email=${yo.email}`,
      'commit', '--quiet', '-m', MENSAJE], dir);
    const principal = (await correr('git', ['symbolic-ref', '--short', 'HEAD'], dir)).stdout.trim();
    await correr('git', ['branch', '-f', 'develop', principal], dir);
    await correr('git', ['push', '--quiet', 'origin', principal, 'develop'], dir);

    // Rama por defecto develop y borrar ramas al integrar (como pide GIT_WORKFLOW.md).
    if (!cloneUrl && process.env.GITHUB_PAT) {
      await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PAT}`, Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json', 'User-Agent': 'discord-organizador',
        },
        body: JSON.stringify({ default_branch: 'develop', delete_branch_on_merge: true, allow_rebase_merge: false }),
      }).catch(() => {});
    }
    const skills = (await correr('git', ['ls-tree', '-d', '--name-only', 'HEAD:.claude/skills'], dir).catch(() => ({ stdout: '' }))).stdout.trim().split('\n').filter(Boolean);
    return { ok: true, skills };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Mensaje fijo en el chat del proyecto: cómo tener las skills.
export function guiaSkillsEmbed(p, resultado) {
  const enRepo = resultado?.ok;
  const e = new EmbedBuilder().setColor(enRepo ? COLORES.exito : COLORES.primario).setTitle('🧭 Skills del equipo');
  if (enRepo) {
    return e.setDescription([
      `El repo **ya trae las skills del equipo**${resultado.skills?.length ? ` (${resultado.skills.length})` : ''}, los subagentes de thermos y las normas de Git.`,
      '',
      '**Para empezar:**',
      `1. Clona el repo: \`git clone ${p.github}\``,
      '2. Ábrelo con Claude Code: las skills se cargan solas.',
      '3. Una sola vez, activa los hooks: `git config core.hooksPath .githooks`',
      '4. Trabaja en ramas desde `develop` (ver `GIT_WORKFLOW.md`).',
      '',
      '-# Opcional: RTK para gastar menos tokens en la terminal (ver 🧠・skills).',
    ].join('\n'));
  }
  return e.setDescription([
    resultado?.error ? `No pude agregar las skills al repo (${resultado.error}). Instálalas en tu equipo:` : 'Instala las skills del equipo en tu equipo:',
    '```bash',
    'npx skills@latest add santiagoricaurte06/discord --skill guia-skills',
    'bash .claude/skills/guia-skills/scripts/instalar.sh --instalar',
    '```',
    p.github ? '-# El responsable puede agregarlas al repo para todos con `/proyecto preparar-repo`.'
      : '-# Este proyecto aún no tiene repo: el responsable puede crearlo con `/proyecto preparar-repo`.',
  ].filter(Boolean).join('\n'));
}

// Prepara el repo sin bloquear la creación del proyecto y avisa en su chat.
export function prepararEnSegundoPlano(guild, p) {
  (async () => {
    let resultado;
    try {
      resultado = await prepararRepo(p.github);
      p.repoPreparado = true;
      p.errorPlantilla = null;
    } catch (err) {
      resultado = { ok: false, error: err.message.slice(0, 200) };
      p.errorPlantilla = resultado.error;
      console.error(`Preparando el repo de ${p.id}:`, err.message);
    }
    save();
    const chat = await guild.channels.fetch(p.channelId).catch(() => null);
    await chat?.send({ embeds: [guiaSkillsEmbed(p, resultado)] }).catch(() => {});
  })();
}
