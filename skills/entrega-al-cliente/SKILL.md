---
name: entrega-al-cliente
description: Prepara la entrega de un sistema, app o web hecha a medida para un cliente, para que pueda usarla, operarla y seguir sin depender de ti. Incluye el inventario de accesos y cuentas a nombre del cliente (dominio, hosting, base de datos, correo, pasarela de pago), las URLs, el código en el formato que el cliente entiende, el manual para el dueño, el manual para los empleados, los videos de capacitación, el canal de soporte y los documentos legales (términos de servicio con propiedad intelectual y límite de responsabilidad, privacidad, DPA, reembolsos), cerrando con un acta de entrega. Úsala cuando digan "voy a entregar el proyecto", "qué le entrego al cliente", "acta de entrega", "manual de usuario", "traspaso", "handoff", "el cliente ya va a pagar" o al cerrar un proyecto para un cliente.
---

# Entrega al cliente

Un proyecto no termina cuando funciona: termina cuando el cliente lo puede usar sin llamarte, es **dueño** de todo lo que pagó y queda claro qué pasa si algo falla. Esta skill arma esa entrega: revisa qué falta, genera los documentos desde las plantillas y deja un acta firmada por las dos partes.

## Flujo

1. **Entiende el proyecto.** Lee el repo (README, `.env.example`, configuración de deploy, migraciones) y pregunta lo que el código no dice:
   - qué compró el cliente: solo el servicio, o también el código;
   - si sigue un mantenimiento contigo;
   - quiénes lo van a usar: el dueño, sus empleados, los clientes del cliente;
   - el país, para lo legal.
2. **Inventario de accesos.** Lista cada servicio del que depende el sistema (mira `.env.example`, `package.json`, la configuración del hosting y los webhooks) y llena [`plantillas/inventario-accesos.md`](plantillas/inventario-accesos.md). **Nunca escribas contraseñas ni llaves en el documento:** solo dónde están (el gestor de contraseñas del cliente) y a nombre de quién.
3. **Recorre la checklist de abajo** y marca qué está listo y qué falta.
4. **Genera los documentos** desde [`plantillas/`](plantillas/) con los datos reales del proyecto: los manuales sacados de las pantallas y flujos que existen de verdad, no de un sistema genérico. Si falta un dato (NIT, dirección, plazos), deja un `TODO` visible y pregúntalo; no lo inventes.
5. **Legal:** revisa que existan los documentos de [`referencias/legal.md`](referencias/legal.md). Si no existen, redacta un borrador y marca que **lo debe revisar un abogado** antes de firmar.
6. **Acta de entrega:** genera [`plantillas/acta-de-entrega.md`](plantillas/acta-de-entrega.md) con todo lo entregado, lo pendiente y la garantía, para que la firmen las dos partes.

## Checklist de entrega

| # | Qué | Por qué |
|---|---|---|
| 1 | **Cuentas a nombre del cliente**: dominio, hosting, base de datos, correo, pasarela de pago, analíticas, tiendas de apps | Si están a tu nombre, el cliente no es dueño de lo que pagó y queda atado a ti. Transfiérelas o crea las cuentas con su correo e invítate como colaborador |
| 2 | **Acceso de administrador** al sistema y a cada servicio | Para que pueda operar y cambiar de proveedor si quiere |
| 3 | **URLs** de producción, del panel de administración y de pruebas (staging) | Para que pruebe todo antes de firmar |
| 4 | **El código**, si lo compró: en el formato que entiende (carpeta, ZIP en su Drive) **y** el repositorio transferido a su cuenta si tiene técnico | "El cliente no sabe lo que es GitHub, quiere el código" |
| 5 | **Manual para el dueño**: administración, configuración, reportes y qué hacer si algo falla | El dueño opera el negocio, no el código |
| 6 | **Manual para los empleados**: solo las tareas del día a día, paso a paso, con capturas | Cada rol ve solo lo que usa |
| 7 | **Videos de capacitación** cortos, uno por tarea | Se aprende más rápido viendo que leyendo |
| 8 | **Canal de soporte**: cómo reportar un problema (tickets, correo o WhatsApp), en qué horario y en cuánto tiempo respondes | Evita llamadas a cualquier hora y deja claro el alcance |
| 9 | **Copias de seguridad**: dónde están, cada cuánto se hacen y cómo se restauran (probado al menos una vez) | Una copia que nunca se restauró no es una copia |
| 10 | **Documentos legales del sistema**: términos, privacidad, reembolsos y DPA si aplica | Ver [`referencias/legal.md`](referencias/legal.md) |
| 11 | **Garantía y mantenimiento**: qué cubre la garantía y por cuánto tiempo, qué es mejora (se cotiza aparte) y el plan de mantenimiento si lo hay | Lo que no está escrito termina en discusión |
| 12 | **Acta de entrega firmada** | Cierra el proyecto y marca el inicio de la garantía |

Opcional: un **asistente de ayuda** dentro del panel (preguntas frecuentes o un chat con los manuales) reduce las consultas de soporte.

## Reglas

- **Nunca pongas secretos en documentos, chats ni correos.** Las contraseñas y llaves van en un gestor de contraseñas compartido con el cliente (Bitwarden, 1Password) o se entregan en persona, y se rotan después de la entrega si tú las conocías.
- **No inventes datos legales ni comerciales** (NIT, plazos de garantía, precios de mantenimiento): pregúntalos o deja `TODO`.
- Los textos legales que redactes son **borradores**: dilo en el documento y recomienda revisión de un abogado.
- Los manuales describen el sistema **real**: recorre las pantallas o el código antes de escribir cada paso.
- Escribe para el cliente, no para un programador: sin jerga técnica en los manuales del dueño y de los empleados.

## Cuándo no usarla

- Para lanzar un sitio propio: usa `checklist-lanzamiento`.
- Para revisar la seguridad antes de entregar: corre antes `revision-seguridad-backend`. Un sistema entregado con fallos de seguridad sigue siendo tu responsabilidad.
