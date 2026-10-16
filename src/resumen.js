// Resumen semanal en 💬・general: avance por proyecto, lo que se cerró en la semana,
// lo que está sin asignar o en revisión, y la carga de cada persona.
// Se publica los lunes a partir de RESUMEN_HORA (9 por defecto) en la zona RESUMEN_TZ (America/Bogota).
import { EmbedBuilder } from 'discord.js';
import { getDb, save, discordDeGithub } from './store.js';
import { COLORES, canal } from './layout.js';
import { avance, barra, ETAPAS } from './tarjetas.js';

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const ZONA = () => process.env.RESUMEN_TZ || 'America/Bogota';
const HORA = () => Number(process.env.RESUMEN_HORA ?? 9);

const reciente = (fecha) => fecha && Date.now() - new Date(fecha).getTime() < SEMANA_MS;

export function resumenEmbeds() {
  const proyectos = Object.values(getDb().proyectos).filter((p) => !p.archivado);
  const carga = new Map(); // discordId|login → { issues, revisiones }
  const sumar = (login, campo) => {
    const clave = discordDeGithub(login) ? `<@${discordDeGithub(login)}>` : `\`${login}\``;
    const c = carga.get(clave) ?? { issues: 0, revisiones: 0 };
    c[campo] += 1;
    carga.set(clave, c);
  };

  const campos = proyectos.map((p) => {
    const a = avance(p);
    const issues = (p.tareas ?? []).filter((t) => t.origen === 'github');
    const abiertos = issues.filter((t) => t.estado !== 'hecha');
    const cerradosSemana = issues.filter((t) => t.estado === 'hecha' && reciente(t.cerradaEn)).length;
    const extrasSemana = (p.tareas ?? []).filter((t) => t.origen === 'extra' && reciente(t.hechaEn)).length;
    const sinAsignar = abiertos.filter((t) => !t.asignados?.length).length;
    abiertos.forEach((t) => (t.asignados ?? []).forEach((l) => sumar(l, 'issues')));
    (p.prs ?? []).forEach((pr) => pr.revisores.forEach((l) => sumar(l, 'revisiones')));

    const lineas = [
      `${a.etapa} · ${barra(a.dev.pct)}${a.mant.total ? ` · 🔧 ${a.mant.hechas}/${a.mant.total}` : ''}`,
      `✅ ${cerradosSemana} issue(s) cerrados esta semana${extrasSemana ? ` · 🔧 ${extrasSemana} arreglo(s)` : ''}`,
      `🟢 ${abiertos.length} abiertos · 👤 ${sinAsignar} sin asignar · 🔍 ${(p.prs ?? []).length} PR en revisión`,
    ];
    if (p.errorIssues) lineas.push(`⚠️ ${p.errorIssues}`);
    if (sinAsignar && a.etapa === ETAPAS.desarrollo) lineas.push('➡️ Hay issues sin responsable: asígnenlos en GitHub.');
    return { name: `◆ ${p.nombre}`, value: lineas.join('\n').slice(0, 1024) };
  });

  const general = new EmbedBuilder().setColor(COLORES.primario)
    .setTitle('📊 Resumen semanal')
    .setDescription(proyectos.length ? `Avance de los ${proyectos.length} proyecto(s) activos en los últimos 7 días.` : 'No hay proyectos activos.')
    .addFields(campos.slice(0, 24))
    .setTimestamp();

  const personas = [...carga.entries()].sort((x, y) => (y[1].issues + y[1].revisiones) - (x[1].issues + x[1].revisiones));
  const equipo = new EmbedBuilder().setColor(COLORES.aviso)
    .setTitle('👥 Quién tiene qué')
    .setDescription(personas.length
      ? personas.map(([quien, c]) => `${quien} · 📌 ${c.issues} issue(s) abiertos${c.revisiones ? ` · 🔍 ${c.revisiones} revisión(es) pendientes` : ''}`).join('\n').slice(0, 4000)
      : 'Nadie tiene issues asignados. Asígnenlos en GitHub y vinculen su cuenta con `/github vincular`.')
    .setFooter({ text: 'Se publica cada lunes · los issues se asignan en GitHub' });

  return [general, equipo];
}

export async function publicarResumen(guild) {
  const destino = canal(guild, 'general');
  if (!destino) return null;
  return destino.send({ embeds: resumenEmbeds(), allowedMentions: { parse: [] } });
}

// Fecha y hora local en la zona configurada.
export function ahoraLocal() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour), dia: partes.weekday };
}

export function iniciarResumenSemanal(client, guildId) {
  const revisar = async () => {
    const { fecha, hora, dia } = ahoraLocal();
    const db = getDb();
    if (dia !== 'Mon' || hora < HORA() || db.ultimoResumen === fecha) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    db.ultimoResumen = fecha;
    save();
    await publicarResumen(guild).catch((e) => console.error('Resumen semanal:', e.message));
  };
  revisar();
  return setInterval(revisar, 15 * 60 * 1000);
}
