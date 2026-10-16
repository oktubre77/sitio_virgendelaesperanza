// Moderación de comentarios de la cadena. Solo con la clave CADENA_CLAVE
// (variable de entorno en Vercel), enviada como "Authorization: Bearer <clave>".
//
// GET  /api/moderar?estado=pend|ok   → comentarios en espera o publicados.
// POST /api/moderar { id, accion }   → accion: aprobar | rechazar | quitar.

const crypto = require('crypto');
const { configuracion, redis, varios, aObjeto, claveIp, dentroDelLimite } = require('./_redis');
const { publico } = require('./comentarios');

const ID = /^[a-f0-9]{12}$/;
const INTENTOS_FALLIDOS_POR_HORA = 10;

// La clave de moderación. Se tolera que el nombre tenga espacios o minúsculas
// por error al cargarlo en Vercel.
function claveConfigurada(env = process.env) {
  if (env.CADENA_CLAVE) return env.CADENA_CLAVE.trim();
  const n = Object.keys(env).find(k => k.trim().toUpperCase() === 'CADENA_CLAVE' && env[k]);
  return n ? env[n].trim() : '';
}

// Para diagnosticar: solo los NOMBRES de variables parecidas, nunca sus valores.
function variablesParecidas(env = process.env) {
  return Object.keys(env).filter(k => /CLAVE|CADENA/i.test(k)).sort();
}

function claveCorrecta(req) {
  const esperada = claveConfigurada();
  const dada = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!esperada || !dada) return false;
  const a = crypto.createHash('sha256').update(esperada).digest();
  const b = crypto.createHash('sha256').update(dada).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = configuracion();
  if (!db) return res.status(503).json({ error: 'sin-base' });
  if (!claveConfigurada()) {
    return res.status(503).json({ error: 'sin-clave', variables: variablesParecidas(), entorno: process.env.VERCEL_ENV || '' });
  }

  try {
    // Frena a quien prueba claves al azar.
    const claveFallos = claveIp(req, 'cf:rlm:');
    const fallos = Number(await redis(db, 'GET', claveFallos)) || 0;
    if (fallos >= INTENTOS_FALLIDOS_POR_HORA) return res.status(429).json({ error: 'limite' });
    if (!claveCorrecta(req)) {
      await dentroDelLimite(db, claveFallos, INTENTOS_FALLIDOS_POR_HORA);
      return res.status(401).json({ error: 'clave' });
    }

    if (req.method === 'GET') {
      const estado = req.query.estado === 'ok' ? 'ok' : 'pend';
      const ids = estado === 'ok'
        ? await redis(db, 'ZREVRANGE', 'cf:com:ok', 0, 199)
        : await redis(db, 'ZRANGE', 'cf:com:pend', 0, 199);
      const hashes = ids.length ? await varios(db, ids.map(id => ['HGETALL', 'cf:com:' + id])) : [];
      const pendientes = await redis(db, 'ZCARD', 'cf:com:pend');
      return res.status(200).json({
        estado,
        pendientes,
        comentarios: ids.map((id, i) => publico(id, aObjeto(hashes[i]))),
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'metodo' });
    }

    const b = typeof req.body === 'object' && req.body ? req.body : {};
    const id = String(b.id || '');
    if (!ID.test(id)) return res.status(400).json({ error: 'id' });
    const k = 'cf:com:' + id;

    if (b.accion === 'aprobar') {
      const fecha = await redis(db, 'ZSCORE', 'cf:com:pend', id);
      if (fecha === null) return res.status(404).json({ error: 'no-esta' });
      await varios(db, [['ZREM', 'cf:com:pend', id], ['ZADD', 'cf:com:ok', fecha, id]], true);
    } else if (b.accion === 'rechazar') {
      await varios(db, [['ZREM', 'cf:com:pend', id], ['DEL', k]], true);
    } else if (b.accion === 'quitar') {
      await varios(db, [['ZREM', 'cf:com:ok', id], ['DEL', k]], true);
    } else {
      return res.status(400).json({ error: 'accion' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('moderar:', err.message);
    return res.status(502).json({ error: 'base' });
  }
};

module.exports.claveConfigurada = claveConfigurada;
