#!/usr/bin/env node
// Busca señales de los 12 puntos de seguridad del backend en el código fuente (JS/TS y Python).
// Uso: node revisar.mjs <carpeta> [--json]
// Sin dependencias (Node 18+). Termina con código 1 si algún punto falla (❌).
// Son SEÑALES, no pruebas: ⚠️ = léelo a mano; ✅ = no se vio el problema (no garantiza que no esté).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const args = process.argv.slice(2);
const raiz = args.find((a) => !a.startsWith('--'));
const comoJson = args.includes('--json');
if (!raiz || !existsSync(raiz) || !statSync(raiz).isDirectory()) {
  console.error('Uso: node revisar.mjs <carpeta-del-codigo> [--json]');
  process.exit(2);
}

// ---------- archivos ----------
const IGNORAR = new Set(['node_modules', '.git', 'skills', 'evals', '.claude', '.agents', '.next', 'dist', 'build', 'out', 'coverage', '.venv', 'venv', '__pycache__', '.turbo', '.vercel']);
const EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.sql', '.prisma']);
const archivos = [];
(function recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    if (IGNORAR.has(nombre) || nombre.startsWith('.')) continue;
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) recorrer(ruta);
    else if (EXT.has(extname(nombre).toLowerCase()) && st.size < 1_500_000) {
      const rel = relative(raiz, ruta).replaceAll('\\', '/');
      if (/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[jt]sx?$/i.test(rel)) continue; // los tests no son la app
      const src = readFileSync(ruta, 'utf8');
      archivos.push({ rel, ext: extname(nombre).toLowerCase(), src, lineas: src.split(/\r?\n/) });
    }
  }
})(raiz);

const codigo = archivos.filter((f) => f.ext !== '.sql' && f.ext !== '.prisma');
const sql = archivos.filter((f) => f.ext === '.sql');
const todo = archivos.map((f) => f.src).join('\n');
const pkg = (() => { try { return readFileSync(join(raiz, 'package.json'), 'utf8'); } catch { return ''; } })();
const pyreq = ['requirements.txt', 'pyproject.toml'].map((n) => { try { return readFileSync(join(raiz, n), 'utf8'); } catch { return ''; } }).join('\n');
const deps = `${pkg}\n${pyreq}`;

const lista = (xs, n = 6) => xs.slice(0, n).join(', ') + (xs.length > n ? ` y ${xs.length - n} más` : '');
const unir = (...p) => p.filter(Boolean).join(' · ');
// Todas las coincidencias de un patrón por línea: ["archivo:línea", ...]
const donde = (re, fs = codigo) => fs.flatMap((f) => f.lineas.flatMap((l, i) => (re.test(l) ? [`${f.rel}:${i + 1}`] : [])));
// Ventana de texto desde una línea (para mirar el cuerpo de un handler)
const ventana = (f, i, n = 40) => f.lineas.slice(i, i + n).join('\n');

// ---------- inventario de endpoints ----------
const endpoints = []; // { donde, tipo, metodo, cuerpo, ruta }
for (const f of codigo) {
  const esAccion = /^\s*['"]use server['"]/m.test(f.src);
  f.lineas.forEach((l, i) => {
    let m;
    if ((m = l.match(/\b(?:app|router|server|api|route)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)/i))) {
      endpoints.push({ donde: `${f.rel}:${i + 1}`, tipo: 'ruta', metodo: m[1].toUpperCase(), ruta: m[2], linea: l, cuerpo: ventana(f, i) });
    } else if (/(^|\/)route\.[jt]sx?$/.test(f.rel) && (m = l.match(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/))) {
      endpoints.push({ donde: `${f.rel}:${i + 1}`, tipo: 'route handler', metodo: m[1], ruta: f.rel, linea: l, cuerpo: ventana(f, i) });
    } else if (esAccion && (m = l.match(/export\s+(?:async\s+function|const)\s+(\w+)/))) {
      endpoints.push({ donde: `${f.rel}:${i + 1}`, tipo: 'server action', metodo: 'POST', ruta: m[1], linea: l, cuerpo: ventana(f, i, 30) });
    } else if (f.ext === '.py' && (m = l.match(/@(?:app|router|api)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)/i))) {
      endpoints.push({ donde: `${f.rel}:${i + 1}`, tipo: 'ruta', metodo: m[1].toUpperCase(), ruta: m[2], linea: l, cuerpo: ventana(f, i, 30) });
    }
  });
}
// El cuerpo de cada endpoint termina donde empieza el siguiente del mismo archivo.
for (const e of endpoints) {
  const [rel, n] = [e.donde.slice(0, e.donde.lastIndexOf(':')), Number(e.donde.split(':').pop())];
  const sig = endpoints.map((x) => x.donde).filter((d) => d.startsWith(`${rel}:`)).map((d) => Number(d.split(':').pop())).filter((m) => m > n).sort((a, b) => a - b)[0];
  if (sig) e.cuerpo = e.cuerpo.split('\n').slice(0, sig - n).join('\n');
}
const publicas = /\b(login|signin|sign-in|signup|sign-up|register|registro|forgot|reset|recuperar|olvid|health|webhook|callback|public|status|ping)\b/i;
const modifica = (e) => e.metodo !== 'GET' || e.tipo === 'server action';

const r = [];
const punto = (n, nombre, estado, detalle) => r.push({ n, nombre, estado, detalle });

// 1. Sesión en el servidor
const AUTH = /\b(auth\(\)|getServerSession|getSession|requireUser|requireAuth|getUser|currentUser|getCurrentUser|isAuthenticated|authenticate|verifyToken|passport\.authenticate|protect|ensureAuth|withAuth|Depends\(\s*get_current_user|login_required|IsAuthenticated|supabase\.auth\.getUser|clerk|auth\.protect)\b/i;
const globalAuth = /\b(app|router)\.use\(\s*(requireAuth|authenticate|auth|protect|verifyToken|isAuthenticated|passport)/i.test(todo) || /middleware\.[jt]s/.test(archivos.map((f) => f.rel).join(' '));
const sinSesion = endpoints.filter((e) => !publicas.test(e.ruta) && !AUTH.test(e.linea) && !AUTH.test(e.cuerpo));
punto(1, 'Sesión verificada en el servidor', !endpoints.length ? 'ok' : sinSesion.length && !globalAuth ? 'error' : sinSesion.length ? 'aviso' : 'ok',
  !endpoints.length ? 'No se detectaron endpoints ni Server Actions (¿no hay backend aquí?).'
    : unir(`${endpoints.length} endpoint(s)/acción(es)`,
      sinSesion.length ? `sin verificación de sesión visible: ${lista(sinSesion.map((e) => `${e.donde} (${e.tipo} ${e.ruta})`))}` : 'todos muestran verificación de sesión',
      globalAuth && sinSesion.length ? 'hay un middleware global de auth: confirma que cubre esas rutas' : ''));

// 2. Entrada validada con esquema
const VALIDA = /\b(z\.object|\.safeParse\(|\.parse\(|Joi\.|yup\.|valibot|v\.object|class-validator|IsString\(|BaseModel\)|pydantic|serializers\.|ajv|typebox|t\.Object)\b/;
const libValida = /"(zod|joi|yup|valibot|ajv|class-validator|@sinclair\/typebox)"|pydantic|djangorestframework/i.test(deps) || VALIDA.test(todo);
const sinValidar = endpoints.filter((e) => modifica(e) && /req\.body|request\.json\(\)|formData|req\.query|req\.params|raw|input|data/i.test(e.cuerpo) && !VALIDA.test(e.cuerpo));
punto(2, 'Entrada validada con esquema', !endpoints.length ? 'ok' : !libValida ? 'error' : sinValidar.length ? 'aviso' : 'ok',
  !endpoints.length ? 'Sin endpoints.' : !libValida ? 'No se usa ninguna librería de validación (zod, joi, pydantic…).'
    : sinValidar.length ? `Usan datos de entrada sin .parse visible: ${lista(sinValidar.map((e) => e.donde))}` : 'Los endpoints que reciben datos los validan.');

// 3. Dueño del recurso (IDOR)
const PORID = /(findById|findByPk|findUnique|findOne|findFirst|\.get\(|\.eq\(\s*['"]id['"]|where\s*:\s*\{\s*id\b|\.(update|delete|destroy|remove)(One|Many)?\(|get_object_or_404|\.filter\(\s*id=)/;
const DUENO = /(owner|userId|user_id|usuario_?id|autor|author|createdBy|created_by|user\.id|session\.user|auth\.uid\(\)|request\.user|puedeVer|canAccess|authorize|forbidden|403)/i;
const idor = endpoints.filter((e) => /(params|query|body|raw|input)[\w.]*\b(id|\w+Id)\b|\bid\b/.test(e.cuerpo) && PORID.test(e.cuerpo) && !DUENO.test(e.cuerpo));
const firmadas = donde(/getSignedUrl|createSignedUrl|createPresignedPost|generate_presigned_url|presign/i);
punto(3, 'Dueño del recurso (IDOR)', idor.length ? 'error' : firmadas.length ? 'aviso' : 'ok',
  unir(idor.length ? `Buscan por ID sin comprobar el dueño: ${lista(idor.map((e) => e.donde))}` : endpoints.length ? 'No se vio acceso por ID sin comprobar dueño.' : 'Sin endpoints.',
    firmadas.length ? `URLs firmadas en ${lista(firmadas, 4)}: confirma que validan el dueño antes de firmar` : ''));

// 4. Lo crítico se calcula en el servidor
const precioCliente = donde(/(req\.body|body|formData\.get\(|raw|input|data)\s*[.[]?\s*['"]?(price|precio|amount|monto|total|subtotal|discount|descuento|price_cents|unit_price)\b/i);
const rolCliente = donde(/(req\.body|body|formData\.get\(|raw|input|data)\s*[.[]?\s*['"]?(role|rol|isAdmin|is_admin|admin|permissions|plan)\b/i);
punto(4, 'Precio, cantidad y rol calculados en el servidor', rolCliente.length ? 'error' : precioCliente.length ? 'aviso' : 'ok',
  unir(rolCliente.length ? `Rol o permisos leídos del cliente: ${lista(rolCliente)}` : '',
    precioCliente.length ? `Precio/total leído del cliente (debe salir de la base): ${lista(precioCliente)}` : '',
    !rolCliente.length && !precioCliente.length ? 'No se vio precio ni rol tomado del cliente. Revisa también que la cantidad sea entera ≥ 1.' : ''));

// 5. Respuesta mínima
const selectTodo = donde(/\.select\(\s*['"]\*['"]\s*\)|SELECT\s+\*\s+FROM/i);
const devuelveTodo = donde(/res\.(json|send)\(\s*(user|usuario|cuenta|account|profile|perfil)\s*\)|return\s+(user|usuario)\s*;?\s*$/i);
const conHash = donde(/res\.(json|send)\([^)]*(password|passwordHash|hash|token)/i);
punto(5, 'Respuesta mínima', conHash.length ? 'error' : selectTodo.length || devuelveTodo.length ? 'aviso' : 'ok',
  unir(conHash.length ? `Respuestas que incluyen password/hash/token: ${lista(conHash)}` : '',
    devuelveTodo.length ? `Devuelven el objeto de usuario completo: ${lista(devuelveTodo)}` : '',
    selectTodo.length ? `select * (elige columnas): ${lista(selectTodo)}` : '') || 'No se vieron respuestas con objetos completos.');

// 6. RLS y llaves
const usaSupabase = /@supabase\/|supabase-js|createClient\([^)]*supabase/i.test(`${deps}\n${todo}`);
const tablas = sql.flatMap((f) => [...f.src.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)].map((m) => m[1].replaceAll('"', '').replace(/^public\./, '')));
const conRls = new Set(sql.flatMap((f) => [...f.src.matchAll(/alter\s+table\s+(?:only\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/gi)].map((m) => m[1].replaceAll('"', '').replace(/^public\./, ''))));
const sinRls = tablas.filter((t) => !conRls.has(t));
const serviceCliente = donde(/(NEXT_PUBLIC|VITE|PUBLIC|EXPO_PUBLIC)_[\w]*SERVICE_ROLE|service_role/i, codigo.filter((f) => /(^|\/)(app|pages|components|src\/(components|pages|app|hooks|lib\/client)|public|client)\//i.test(f.rel) && !/(^|\/)(api|server)\//i.test(f.rel)));
punto(6, 'RLS y llaves (Supabase)', !usaSupabase ? 'ok' : serviceCliente.length || sinRls.length ? 'error' : !tablas.length ? 'aviso' : 'ok',
  !usaSupabase ? 'No aplica (no usa Supabase). Si la BD es accesible desde el cliente (Firebase…), revisa sus reglas.'
    : unir(serviceCliente.length ? `service_role en código del cliente: ${lista(serviceCliente)} (rótala)` : '',
      sinRls.length ? `Tablas sin "enable row level security": ${lista(sinRls)}` : '',
      !tablas.length ? 'No hay migraciones .sql en el repo: revisa RLS y políticas en el panel de Supabase' : '',
      tablas.length && !sinRls.length ? `${tablas.length} tabla(s) con RLS: revisa que tengan políticas (create policy)` : ''));

// 7. Rate limiting
const libLimite = /"(express-rate-limit|rate-limiter-flexible|@upstash\/ratelimit|express-slow-down|@fastify\/rate-limit|hono-rate-limiter|bottleneck)"|slowapi|django-ratelimit|limits/i.test(deps) || /rateLimit|RateLimiter|Ratelimit|ratelimit|429/.test(todo);
const rutasLogin = endpoints.filter((e) => /login|signin|sign-in|signup|register|registro|forgot|reset|recuperar|otp|verify|codigo/i.test(e.ruta));
const bloqueoFijo = donde(/(failedAttempts|intentos(Fallidos)?|loginAttempts)\s*(>=|>|===)\s*\d+[^\n]*(lock|bloque|disabled|blocked)/i);
punto(7, 'Rate limiting por capas', !endpoints.length ? 'ok' : !libLimite ? (rutasLogin.length ? 'error' : 'aviso') : 'aviso',
  !endpoints.length ? 'Sin endpoints.' : unir(rutasLogin.length ? `Rutas sensibles: ${lista(rutasLogin.map((e) => `${e.ruta} (${e.donde})`), 4)}` : '',
    !libLimite ? 'No se detectó rate limiting.' : 'Hay rate limiting: confirma que limita por IP Y por cuenta y responde 429',
    bloqueoFijo.length ? `Bloqueo fijo de cuenta tras N fallos (cualquiera puede bloquear cuentas ajenas): ${lista(bloqueoFijo)}` : ''));

// 8. Contraseñas
const buenHash = /"(argon2|@node-rs\/argon2|bcrypt|bcryptjs|@node-rs\/bcrypt)"|argon2|bcrypt|passlib|make_password|scrypt/i.test(`${deps}\n${todo}`);
const hashMalo = donde(/(md5|sha1|sha256|sha512|createHash\(\s*['"](md5|sha1|sha256)['"])[^\n]*(pass|contrase|pwd)|(pass|contrase|pwd)[^\n]*(md5|sha1|createHash|hashlib\.(md5|sha1|sha256))/i);
const cifrada = donde(/(createCipheriv|encrypt|cifrar|Fernet|AES)[^\n]*(pass|contrase|pwd)|(pass|contrase|pwd)[^\n]*(createCipheriv|encrypt\(|cifrar\()/i);
const plano = donde(/(password|contrasena|pwd)\s*===?\s*(req\.body|body|input|user\.(password|contrasena))|user\.password\s*===?/i);
const manejaPass = /password|contraseña|contrasena/i.test(todo);
punto(8, 'Contraseñas con argon2/bcrypt', hashMalo.length || cifrada.length || plano.length ? 'error' : !manejaPass ? 'ok' : buenHash ? 'ok' : 'aviso',
  unir(hashMalo.length ? `Hash rápido (MD5/SHA) para contraseñas: ${lista(hashMalo)}` : '', cifrada.length ? `Contraseñas cifradas (reversible): ${lista(cifrada)}` : '',
    plano.length ? `Comparación en texto plano: ${lista(plano)}` : '')
  || (!manejaPass ? 'No maneja contraseñas propias.' : buenHash ? 'Usa argon2/bcrypt/scrypt.' : 'Maneja contraseñas pero no se ve argon2/bcrypt (¿las gestiona un proveedor de auth?).'));

// 9. Recuperación de cuenta
const archReset = codigo.filter((f) => /(reset|forgot|olvid)[\w-]*(pass|contra)?|recuperar-?(contra|cuenta)/i.test(f.rel)
  || /resetToken|reset_token|forgotPassword|forgot_password|passwordReset|password_reset|recuperar[_ ]?(contrase|cuenta|password)|olvid[eé] mi contrase/i.test(f.src));
const txtReset = archReset.map((f) => f.src).join('\n');
const sinExpira = archReset.length && !/expir|expires|ttl|exp\b|valid_until|vence/i.test(txtReset);
const revela = archReset.flatMap((f) => f.lineas.flatMap((l, i) => (/(no existe|not found|no encontrad|no registrad|doesn'?t exist|unknown email|correo inv[aá]lido)/i.test(l) ? [`${f.rel}:${i + 1}`] : [])));
const cierraSesiones = /revoke|invalidate|deleteMany\([^)]*session|sessions?\.(delete|destroy|clear)|logoutAll|cerrarSesiones|tokenVersion/i.test(txtReset);
const tokenDebil = archReset.flatMap((f) => f.lineas.flatMap((l, i) => (/Math\.random\(|Date\.now\(\)\s*\.toString|uuid\(\)|v4\(\)/.test(l) && /token|code|codigo/i.test(l) ? [`${f.rel}:${i + 1}`] : [])));
punto(9, 'Recuperación de cuenta', !archReset.length ? 'ok' : revela.length || sinExpira || tokenDebil.length ? 'error' : !cierraSesiones ? 'aviso' : 'ok',
  !archReset.length ? 'No se detectó flujo de recuperación propio.'
    : unir(sinExpira ? 'El token de recuperación no muestra expiración' : '', revela.length ? `Revela si el correo existe: ${lista(revela)}` : '',
      tokenDebil.length ? `Token poco aleatorio (usa crypto.randomBytes): ${lista(tokenDebil)}` : '',
      !cierraSesiones ? 'No se ve que cierre las otras sesiones al cambiar la contraseña' : '') || 'Expira, no revela cuentas y cierra sesiones.');

// 10. Tokens y sesiones
const enStorage = donde(/(localStorage|sessionStorage)\.setItem\([^)]*(token|jwt|session|auth|access)/i);
const cookieSinHttpOnly = codigo.flatMap((f) => f.lineas.flatMap((l, i) => {
  if (!/(res\.cookie\(|cookies\(\)\.set\(|set_cookie\(|Set-Cookie|setCookie\()/i.test(l)) return [];
  return /httpOnly|httponly/i.test(ventana(f, i, 6)) ? [] : [`${f.rel}:${i + 1}`];
}));
punto(10, 'Tokens en cookies HttpOnly', enStorage.length ? 'error' : cookieSinHttpOnly.length ? 'aviso' : 'ok',
  unir(enStorage.length ? `Token guardado en localStorage/sessionStorage: ${lista(enStorage)}` : '',
    cookieSinHttpOnly.length ? `Cookies sin httpOnly visible: ${lista(cookieSinHttpOnly)}` : '') || 'No se vieron tokens en localStorage ni cookies sin HttpOnly.');

// 11. Datos de tarjeta
const tarjeta = donde(/\b(cvv|cvc|cvv2|card_?number|cardNumber|numero_?tarjeta|pan\b|track_?data|banda|pin_?tarjeta)\b/i, archivos);
punto(11, 'Datos de tarjeta', tarjeta.length ? 'error' : 'ok',
  tarjeta.length ? `Se mencionan CVV o número de tarjeta en código o esquema: ${lista(tarjeta)}. Nunca se guardan: tokeniza con la pasarela.`
    : 'No se vieron campos de tarjeta (si cobras, que sea con el token de la pasarela).');

// 12. Deploy seguro
const ci = existsSync(join(raiz, '.github', 'workflows')) || existsSync(join(raiz, '.gitlab-ci.yml')) || existsSync(join(raiz, 'vercel.json')) || existsSync(join(raiz, 'railway.json'));
const flags = donde(/(featureFlag|FEATURE_|isEnabled\(|killSwitch|KILL_SWITCH|unleash|launchdarkly|growthbook|flagsmith)/i);
const muerto = donde(/(deprecated|legacy|old_|_old\b|unused|no se usa|obsolet)/i).length;
punto(12, 'Deploy seguro', 'aviso',
  unir(ci ? 'Hay CI/deploy automático configurado' : 'No se vio CI ni deploy automático (.github/workflows, vercel.json…)',
    flags.length ? `flags/kill switch en ${lista(flags, 3)}` : 'sin flags ni botón de apagado visibles',
    muerto ? `${muerto} línea(s) marcadas legacy/deprecated/unused: borra el código muerto` : '',
    `corre ${/pyproject|requirements/.test(pyreq) ? 'pip-audit' : 'npm audit'} y actualiza el framework a su último parche`));

// ---------- salida ----------
r.sort((a, b) => a.n - b.n);
if (comoJson) {
  console.log(JSON.stringify({ carpeta: raiz, archivos: archivos.length, endpoints: endpoints.map(({ donde, tipo, metodo, ruta }) => ({ donde, tipo, metodo, ruta })), resultados: r }, null, 2));
} else {
  const ic = { ok: '✅', aviso: '⚠️ ', error: '❌' };
  console.log(`\nRevisión de seguridad del backend · ${raiz} · ${archivos.length} archivo(s) · ${endpoints.length} endpoint(s)\n`);
  if (endpoints.length) {
    console.log('Endpoints y acciones:');
    for (const e of endpoints.slice(0, 40)) console.log(`   ${e.metodo.padEnd(6)} ${e.ruta}  (${e.tipo}, ${e.donde})`);
    if (endpoints.length > 40) console.log(`   … y ${endpoints.length - 40} más (usa --json)`);
    console.log('');
  }
  for (const x of r) console.log(`${ic[x.estado]} ${String(x.n).padStart(2)}. ${x.nombre}\n      ${x.detalle}`);
  const c = (e) => r.filter((x) => x.estado === e).length;
  console.log(`\nResultado: ${c('ok')} ✅ · ${c('aviso')} ⚠️  · ${c('error')} ❌`);
  console.log('Son señales: lee cada endpoint con referencias/puntos.md. El 12 siempre se confirma a mano.\n');
}
process.exit(r.some((x) => x.estado === 'error') ? 1 : 0);
