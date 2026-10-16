// Foro 🏆・proyectos-aprobados: una publicación por proyecto (creado por votación o a mano)
// con responsable, repo, equipo, estado y progreso. El estado también va como etiqueta del foro.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from 'discord.js';
import { getDb, save } from './store.js';
import { COLORES, canal } from './layout.js';

export const ETAPAS = {
  pendiente: '⏳ Por iniciar',
  desarrollo: '🛠️ Desarrollo',
  produccion: '🚀 Producción',
  mantenimiento: '🔧 Mantenimiento',
  pausado: '⏸️ Pausado',
  archivado: '🗄️ Archivado',
};

// Etiquetas del foro: una por etapa (nombre sin el emoji, el emoji va aparte).
export const ETIQUETAS = Object.values(ETAPAS).map((e) => {
  const [emoji, ...nombre] = e.split(' ');
  return { name: nombre.join(' '), emoji: { id: null, name: emoji } };
});

// Etapa y avance del proyecto (todo automático, salvo Pausado y Archivado):
// - Desarrollo: % = issues de GitHub cerrados ÷ total. Por iniciar si aún no hay issues.
// - Producción: todos los issues cerrados. Mantenimiento: en producción con tareas extra pendientes.
export function avance(p) {
  const vacio = { total: 0, hechas: 0, pct: 0 };
  if (!p) return { etapa: ETAPAS.pendiente, dev: vacio, mant: vacio, enProduccion: false };
  const contar = (lista) => {
    const hechas = lista.filter((t) => t.estado === 'hecha').length;
    return { total: lista.length, hechas, pct: lista.length ? Math.round((hechas / lista.length) * 100) : 0 };
  };
  const dev = contar((p.tareas ?? []).filter((t) => t.origen === 'github'));
  const mant = contar((p.tareas ?? []).filter((t) => t.origen === 'extra'));
  const enProduccion = dev.total > 0 && dev.hechas === dev.total;
  let etapa = ETAPAS.desarrollo;
  if (!dev.total) etapa = ETAPAS.pendiente;
  if (enProduccion) etapa = mant.hechas < mant.total ? ETAPAS.mantenimiento : ETAPAS.produccion;
  if (p.pausado) etapa = ETAPAS.pausado;
  if (p.archivado) etapa = ETAPAS.archivado;
  return { etapa, dev, mant, enProduccion };
}

export function barra(pct, largo = 10) {
  const llenos = Math.round((Math.max(0, Math.min(100, pct)) / 100) * largo);
  return `${'▰'.repeat(llenos)}${'▱'.repeat(largo - llenos)} **${pct}%**`;
}

const ideaDe = (p) => getDb().ideas.find((i) => i.proyecto === p.id);

// Contenido de la tarjeta. `p` = proyecto (puede faltar si falló su creación), `idea` = idea de origen (opcional).
function contenido({ p, idea }) {
  const a = avance(p);
  const titulo = p?.nombre ?? idea.titulo;
  let detalleDev = 'Se calcula con los issues de GitHub cuando se cree el proyecto.';
  if (p) detalleDev = a.dev.total ? `${a.dev.hechas}/${a.dev.total} issues cerrados` : 'El repositorio aún no tiene issues.';
  if (p && !p.github) detalleDev = 'El proyecto no tiene repositorio de GitHub.';
  if (p?.errorIssues) detalleDev = `⚠️ ${p.errorIssues}`;
  const origen = idea
    ? `💡 Idea de <@${idea.autor}> · aprobada con ✅ ${idea.votosSi}`
    : `✍️ Creado manualmente por <@${p.autor}>`;

  // Seguimiento: issues abiertos con y sin responsable, y PRs en revisión.
  const abiertos = (p?.tareas ?? []).filter((t) => t.origen === 'github' && t.estado !== 'hecha');
  const sinAsignar = abiertos.filter((t) => !t.asignados?.length).length;
  const revision = (p?.prs ?? []).length;
  const seguimiento = p && a.dev.total
    ? `🟢 ${abiertos.length} abiertos · 👤 ${sinAsignar} sin asignar · 🔍 ${revision} PR en revisión`
    : null;

  const campos = [
    { name: 'Estado', value: a.etapa, inline: true },
    { name: '⭐ Responsable', value: p ? `<@${p.autor}>` : '—', inline: true },
    { name: '🐙 Repositorio', value: p?.github ?? (p?.errorRepo ? `⚠️ ${p.errorRepo}` : '—'), inline: true },
    { name: `👥 Equipo${p ? ` (${p.miembros.length})` : ''}`, value: p ? (p.miembros.map((m) => `<@${m}>`).join(' ') || '—') : '*Sin proyecto — usa el botón para crearlo*' },
    { name: '🛠️ Desarrollo', value: `${barra(a.dev.pct)}\n-# ${detalleDev}` },
  ];
  if (a.enProduccion || a.mant.total) {
    const detalleMant = a.mant.total ? `${a.mant.hechas}/${a.mant.total} tareas extra hechas` : 'Sin tareas extra pendientes';
    campos.push({ name: '🔧 Mantenimiento', value: `${barra(a.mant.total ? a.mant.pct : 100)}\n-# ${detalleMant}` });
  }
  if (seguimiento) campos.push({ name: 'Seguimiento', value: seguimiento });
  campos.push({ name: 'Origen', value: origen });

  const colores = {
    [ETAPAS.produccion]: COLORES.primario, [ETAPAS.mantenimiento]: COLORES.aviso, [ETAPAS.pausado]: COLORES.github,
  };
  const embed = new EmbedBuilder()
    .setColor(colores[a.etapa] ?? COLORES.exito)
    .setTitle(`◆ ${titulo}`)
    .setDescription(p?.descripcion ?? idea.descripcion)
    .addFields(campos)
    .setFooter({ text: p ? `Proyecto ${p.id}` : `Idea #${idea.id}` })
    .setTimestamp();

  // Con proyecto: el responsable asigna el equipo. Sin proyecto (falló la creación): botón para crearlo.
  const boton = p
    ? new ButtonBuilder().setCustomId(`proyecto-miembros:${p.id}`).setLabel('Asignar equipo').setEmoji('👥').setStyle(ButtonStyle.Primary)
    : new ButtonBuilder().setCustomId(`idea-proyecto:${idea.id}`).setLabel('Crear proyecto').setEmoji('🚀').setStyle(ButtonStyle.Success);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(boton)], allowedMentions: { parse: [] } };
}

function etiquetaDe(foro, etapa) {
  const nombre = etapa.split(' ').slice(1).join(' ');
  const tag = foro.availableTags.find((t) => t.name === nombre);
  return tag ? [tag.id] : [];
}

// Crea las etiquetas que falten en el foro.
export async function ensureEtiquetas(foro) {
  const faltan = ETIQUETAS.filter((e) => !foro.availableTags.some((t) => t.name === e.name));
  if (faltan.length) await foro.setAvailableTags([...foro.availableTags, ...faltan]);
}

// Dónde se guarda la publicación: en el proyecto, o en la idea si aún no hay proyecto.
const dueñoDeTarjeta = ({ p, idea }) => p ?? idea;

export async function publicarTarjeta(guild, { p, idea }) {
  const foro = canal(guild, 'ideasAprobadas');
  if (!foro) return null;
  await ensureEtiquetas(foro);
  const { etapa } = avance(p);
  const thread = await foro.threads.create({
    name: `◆ ${p?.nombre ?? idea.titulo}`.slice(0, 100),
    message: contenido({ p, idea }),
    appliedTags: etiquetaDe(foro, etapa),
  });
  dueñoDeTarjeta({ p, idea }).tarjetaId = thread.id;
  save();
  return thread;
}

export async function refrescarTarjeta(guild, { p, idea }) {
  const dueño = dueñoDeTarjeta({ p, idea });
  const foro = canal(guild, 'ideasAprobadas');
  const thread = dueño?.tarjetaId && await guild.channels.fetch(dueño.tarjetaId).catch(() => null);
  if (!thread || !foro) return;
  if (thread.archived) await thread.setArchived(false).catch(() => {});
  const starter = await thread.fetchStarterMessage().catch(() => null);
  await starter?.edit(contenido({ p, idea })).catch(() => {});
  const tags = etiquetaDe(foro, avance(p).etapa);
  if (tags.join() !== thread.appliedTags.join()) await thread.setAppliedTags(tags).catch(() => {});
  const nombre = `◆ ${p?.nombre ?? idea.titulo}`.slice(0, 100);
  if (thread.name !== nombre) await thread.setName(nombre).catch(() => {});
}

export async function refrescarTarjetaDeProyecto(guild, proyectoId) {
  const p = getDb().proyectos[proyectoId];
  if (p) await refrescarTarjeta(guild, { p, idea: ideaDe(p) });
}

// Al crear el proyecto de una idea cuya creación automática falló: la publicación pasa de la idea al proyecto.
export async function vincularTarjeta(guild, idea, p) {
  if (idea.tarjetaId && !p.tarjetaId) {
    p.tarjetaId = idea.tarjetaId;
    delete idea.tarjetaId;
    save();
    await refrescarTarjeta(guild, { p, idea });
  } else if (!p.tarjetaId) {
    await publicarTarjeta(guild, { p, idea });
  }
}
