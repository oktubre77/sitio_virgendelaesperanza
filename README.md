# sitio_virgendelaesperanza

## Flujo recomendado para Avisos (WhatsApp -> Web)

### Objetivo
Recibir la información del folleto por WhatsApp y publicarla en la sección **Avisos** sin editar código cada vez.

### Paso 1: Crear Google Form conectado a una hoja
Crear un formulario con estos campos:
- `titulo`
- `fecha`
- `resumen`
- `detalle`
- `imagen` (URL de imagen pública)
- `estado` (usar valores: `borrador` o `publicado`)

Configurar el formulario para que guarde respuestas en Google Sheets.

### Paso 2: Publicar la hoja como CSV
En Google Sheets:
1. Archivo -> Compartir -> Publicar en la web
2. Elegir la pestaña de avisos
3. Formato: `CSV`
4. Copiar la URL publicada

### Paso 3: Conectar el sitio
En `index.html`, dentro del script principal, buscar:

`const AVISOS_CSV_URL = '';`

Pegar allí la URL CSV publicada.

### Paso 4: Publicación
- Cada aviso nuevo llega por WhatsApp.
- Se carga en el Google Form.
- Solo los avisos con `estado = publicado` se muestran en la web.

### Encabezados esperados en CSV
La lectura automática usa estos nombres de columnas (sin importar mayúsculas):
- `titulo`
- `fecha`
- `resumen`
- `detalle`
- `imagen`
- `estado`

Si no hay URL configurada o falla la carga remota, el sitio usa los avisos locales de respaldo.

## Cadena de favores (`/cadena-de-favores/`)

Cada enlace de la cadena tiene un código propio (`c`) y el del eslabón anterior (`p`).
La primera vez que alguien abre un enlace, la función `api/cadena.js` lo guarda con
número = anterior + 1. Así el número no se puede trucar y la página muestra los totales:
veces que se pasó, eslabón más lejano y cadenas empezadas.

### Conectar la base de datos (una sola vez)
1. En Vercel, abrir el proyecto → pestaña **Storage** → **Create Database** → **Upstash for Redis** (plan gratuito).
2. Conectarla a este proyecto. Vercel crea solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. Volver a desplegar (Deployments → Redeploy).

Mientras la base no esté conectada, la página igual funciona: muestra el número que viene
en el enlace (`e`) y no muestra los totales.

### Qué se guarda
- `cf:l:<código>`: número de eslabón, código anterior y fecha.
- `cf:total`, `cf:max`, `cf:cadenas`: los totales.
- `cf:rl:<hash>`: límite de 30 eslabones nuevos por hora por conexión (la IP se guarda solo como hash y se borra a la hora).

### Comentarios de la cadena
En `/cadena-de-favores/` la gente puede contar cómo pasó la cadena. **Nada se publica
sin aprobación**: los comentarios quedan en espera hasta que la persona que modera los aprueba en
`/cadena-de-favores/moderar.html`.

Para habilitar la moderación (una sola vez):
1. En Vercel → **Settings** → **Environment Variables**, crear `CADENA_CLAVE` con una clave larga (Production y Preview).
2. **Redeploy**.

Límites: 5 comentarios por hora por conexión, 500 caracteres, hasta 300 en espera.
Claves en la base: `cf:com:<id>` (texto, nombre, eslabón, fecha), `cf:com:pend` y `cf:com:ok`.
