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