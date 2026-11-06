# Documentos legales de un sistema que se entrega o se cobra

> Esto es una guía para no olvidar nada, no asesoría legal. Lo que se redacte con ella es un **borrador** que debe revisar un abogado del país del cliente.

## Del sistema (los ven los usuarios)

| Documento | Debe decir | Ojo con |
|---|---|---|
| **Términos de servicio** | Qué pueden y qué no pueden hacer los usuarios; qué **no** se garantiza; cuándo se puede suspender una cuenta; hasta dónde llega la responsabilidad | Copiarlos de otra página: no describen tu producto y te dejan sin protección |
| **Política de privacidad** | Qué datos se recogen, para qué, con quién se comparten y cómo se borran | Que **coincida con lo que la app hace**. Si dice una cosa y la app hace otra, estás engañando a los usuarios. Se acepta en una **casilla aparte** de los términos |
| **Política de reembolsos** | Cuándo, cómo y en qué plazo se devuelve el dinero; el derecho de retracto | Los procesadores de pago la piden. En Colombia, 5 días hábiles de retracto en ventas a distancia |

## Entre tú y el cliente (contrato de desarrollo o licencia)

| Cláusula | Por qué |
|---|---|
| **Propiedad intelectual** | Deja claro qué es del cliente (lo que pagó) y qué es tuyo y solo se licencia: librerías propias, plantillas, componentes reutilizables. Sin esto, cualquier función que te pida puede reclamarla como suya |
| **Límite de responsabilidad** | Hasta cuánto respondes si algo falla (por ejemplo, lo pagado en los últimos 12 meses). Sin límite, si el cliente factura 100.000 dólares al mes y la plataforma se cae, te puede cobrar todo |
| **Nivel de servicio (SLA)** | Disponibilidad comprometida, tiempos de respuesta del soporte y qué pasa si no se cumplen |
| **Garantía** | Qué cubre (defectos de lo entregado), por cuánto tiempo y qué no cubre (mejoras, cambios de alcance, fallas de terceros) |
| **DPA (acuerdo de procesamiento de datos)** | Necesario si **tú** procesas datos en nombre del cliente, por ejemplo si alojas el sistema y ves los datos de sus empleados o de sus clientes. Define quién es responsable y quién es encargado de los datos |

## Colombia

- **Ley 1581 de 2012** (protección de datos) y la **SIC** como autoridad. Hay que poder **probar** la autorización de cada titular: registro con fecha, versión del texto y medio. Las multas pueden ser altas; confirma los montos vigentes con el abogado.
- **Estatuto del Consumidor** (Ley 1480 de 2011): derecho de retracto y garantías en ventas a consumidores.
- Facturación electrónica de la DIAN si el sistema factura.
