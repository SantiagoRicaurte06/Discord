# Bot Organizador de Proyectos para Discord

Bot para organizar **proyectos, ideas, archivos y links de Google Drive** en un servidor de Discord, más la configuración del MCP de Discord para Claude Code.

## Qué hace

| Comando | Qué hace |
|---|---|
| `/setup` | Crea o actualiza la estructura y el estilo del servidor (nombres, íconos y orden en `src/layout.js`) |
| `/proyecto crear` | Crea un canal para el proyecto con una ficha fijada (descripción, estado, carpeta de Drive, links) |
| `/proyecto lista` · `info` · `estado` · `archivar` | Gestión de proyectos (con autocompletado de nombres) |
| `/drive agregar` · `lista` | Guarda y lista links de Drive/Docs/Sheets/Slides, por proyecto o globales |
| `/idea nueva` · `lista` · `aprobar` | Ideas con votación 👍👎 e hilo de discusión; `aprobar` la convierte en proyecto |
| `/ayuda` | Muestra la guía |

Automático:
- Cualquier link de Google Drive pegado en el servidor se registra en **#links-drive** (reacciona 📎). Si se pega en el canal de un proyecto, queda asociado a ese proyecto.
- Los archivos subidos en un canal de proyecto se registran en **#archivos** (reacciona 🗂️).

Los datos se guardan en `data/db.json`.

## Puesta en marcha

1. **Crea el servidor** en Discord (botón ➕ en la barra izquierda → "Crear el mío"). Los bots no pueden crear servidores, así que este paso es manual.
2. **Crea el bot** en https://discord.com/developers/applications → *New Application*.
   - Pestaña **Bot** → *Reset Token* → copia el token.
   - En **Privileged Gateway Intents** activa **Message Content Intent**.
3. **Invita el bot**: pestaña *OAuth2 → URL Generator*, scopes `bot` + `applications.commands`, permiso `Administrator` (o al menos Manage Channels, Send Messages, Embed Links, Add Reactions, Manage Messages, Create Public Threads, Read Message History). Abre la URL y elige tu servidor.
4. Configura e inicia:
   ```bash
   cp .env.example .env   # rellena DISCORD_TOKEN, CLIENT_ID y GUILD_ID
   npm install
   npm run deploy         # registra los slash commands
   npm start
   ```
5. En Discord escribe `/setup` y luego `/proyecto crear`.

> Para que el bot funcione 24/7 debe correr en un servidor (Railway, Render, un VPS, etc.), no solo en tu PC.

## MCP de Discord para Claude Code

Este repo incluye `.mcp.json`, que usa la variable de entorno `DISCORD_TOKEN` (el token nunca se guarda en git). Alternativa manual:

```bash
claude mcp add discord -e DISCORD_TOKEN=TU_TOKEN -- npx -y @pasympa/discord-mcp
```

Con el MCP conectado, Claude puede leer/enviar mensajes y gestionar canales del servidor donde esté el bot.

## Inicio de sesión con GitHub (`/github vincular`)

Cada persona vincula su cuenta iniciando sesión en GitHub con un código (Device Flow), así nadie puede vincular una cuenta ajena.
1. GitHub → Settings → Developer settings → **OAuth Apps** → *New OAuth App*.
2. Nombre (ej. "Zy Discord"), Homepage URL y Callback URL: cualquier URL válida (ej. `https://discord.com`); no se usan.
3. Crea la app, marca **Enable Device Flow** y guarda.
4. Copia el **Client ID** en `GITHUB_CLIENT_ID`. No hace falta generar el client secret.

El bot solo lee el nombre de usuario con un token de permisos mínimos y no lo guarda.

## Desplegar 24/7

El bot necesita: Node 18+, salida a internet (Discord y api.github.com) y **disco persistente** para `db.json`.

**Recomendado: Railway** (~US$5/mes, el plan Hobby)
1. New Project → *Deploy from GitHub repo* → este repo y la rama del bot.
2. Variables: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `GITHUB_PAT`, `DATA_DIR=/data`.
3. Agrega un **Volume** montado en `/data` (sin volumen, la base se borra en cada deploy).
4. Start command: `npm start`. La primera vez corre `npm run deploy` y `npm run setup` desde la consola del servicio.

**Gratis: Oracle Cloud Always Free** (VM Linux): instala Node 22, clona el repo, crea `.env`, y déjalo corriendo con `pm2 start src/index.js --name bot && pm2 save && pm2 startup`.

**Raspberry Pi** (Pi 4 o 5 con 2 GB o más alcanza de sobra)
1. Instala Raspberry Pi OS Lite (64-bit) y Node 22: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs git`.
2. `git clone` del repo en `/home/pi/discord`, `npm install`, crea `.env` (copia de `.env.example`).
3. Recomendado: guarda los datos en un SSD USB en vez de la tarjeta SD (`DATA_DIR=/mnt/ssd/discord-data`).
4. `npm run deploy && npm run setup`, luego instala el servicio: ver `deploy/discord-bot.service`.

**Base de datos**: es un archivo JSON (`$DATA_DIR/db.json`). Se guarda de forma atómica (no se corrompe con un corte de luz)
y cada día se hace una copia en `$DATA_DIR/backups/` (se conservan 14). Si `db.json` se daña, el bot arranca con la última copia buena.
Para tener una copia fuera del equipo, sincroniza la carpeta `backups/` con Google Drive usando `rclone` en un cron.

Corre **una sola instancia** a la vez: dos bots con el mismo token se pisan la base de datos.
