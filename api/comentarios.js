// Comentarios de la cadena de favores.
//
// GET  /api/comentarios        → los últimos comentarios aprobados.
// POST /api/comentarios        → deja un comentario nuevo, en espera de revisión.
//      { texto, nombre?, c? }    c = código del eslabón de quien escribe.
//
// Nada se publica sin que la persona que modera lo apruebe (ver api/moderar.js).

const crypto = require('crypto');
const { configuracion, redis, varios, aObjeto, claveIp, dentroDelLimite } = require('./_redis');

const TOKEN = /^[A-Za-z0-9]{6,16}$/;
const MAX_TEXTO = 500;
const MAX_NOMBRE = 40;
const MAX_PENDIENTES = 300;    // si se llena la cola, no se aceptan más hasta revisar
const LIMITE_POR_HORA = 5;     // comentarios por conexión por hora
const MOSTRAR = 50;

function limpiar(s, max) {
  return String(s || '')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') // controles (se deja el salto de línea)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

// Lo que se muestra en la página: nunca el estado interno ni datos de quien escribió.
function publico(id, h) {
  return {
    id,
    texto: h.texto || '',
    nombre: h.nombre || '',
    eslabon: h.eslabon ? Number(h.eslabon) : null,
    fecha: h.fecha || '',
  };
}

async function listarAprobados(db) {
  const ids = await redis(db, 'ZREVRANGE', 'cf:com:ok', 0, MOSTRAR - 1);
  if (!ids.length) return [];
  const hashes = await varios(db, ids.map(id => ['HGETALL', 'cf:com:' + id]));
  return ids.map((id, i) => publico(id, aObjeto(hashes[i]))).filter(c => c.texto);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = configuracion();
  if (!db) return res.status(503).json({ error: 'sin-base' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ comentarios: await listarAprobados(db) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'metodo' });
    }

    const b = typeof req.body === 'object' && req.body ? req.body : {};
    // Campo trampa: las personas no lo ven; los robots suelen llenarlo.
    if (b.web) return res.status(200).json({ ok: true });

    const texto = limpiar(b.texto, MAX_TEXTO);
    const nombre = limpiar(b.nombre, MAX_NOMBRE).replace(/\n/g, ' ');
    const c = TOKEN.test(String(b.c || '')) ? String(b.c) : '';
    if (texto.length < 3) return res.status(400).json({ error: 'texto' });

    if (!(await dentroDelLimite(db, claveIp(req, 'cf:rlc:'), LIMITE_POR_HORA))) {
      return res.status(429).json({ error: 'limite' });
    }
    const [pendientes, eslabon] = await varios(db, [
      ['ZCARD', 'cf:com:pend'],
      c ? ['HGET', 'cf:l:' + c, 'n'] : ['ECHO', ''],
    ]);
    if (pendientes >= MAX_PENDIENTES) return res.status(503).json({ error: 'cola-llena' });

    const id = crypto.randomBytes(6).toString('hex');
    const ahora = Date.now();
    await varios(db, [
      ['HSET', 'cf:com:' + id, 'texto', texto, 'nombre', nombre, 'eslabon', eslabon || '', 'fecha', new Date(ahora).toISOString()],
      ['ZADD', 'cf:com:pend', ahora, id],
    ], true);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('comentarios:', err.message);
    return res.status(502).json({ error: 'base' });
  }
};

module.exports.publico = publico;
module.exports.limpiar = limpiar;
