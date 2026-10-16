# Bot Organizador de Proyectos para Discord

Bot para organizar **proyectos, ideas, archivos y links de Google Drive** en un servidor de Discord, más la configuración del MCP de Discord para Claude Code.

## Qué hace

| Comando | Qué hace |
|---|---|
| `/setup` | Crea la estructura del servidor: 📌 GENERAL, 💡 IDEAS, 📁 PROYECTOS, 🔗 RECURSOS, 🗄️ ARCHIVADOS |
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
