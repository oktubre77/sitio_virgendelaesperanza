// Cadena de favores: guarda cada eslabón y devuelve los totales.
//
// GET /api/cadena?c=<eslabón>&p=<eslabón anterior>
//   - Sin c: solo devuelve los totales (quien entra sin enlace es el eslabón 1).
//   - Con c: la primera vez que alguien abre ese enlace se registra el eslabón,
//     con número = número del anterior + 1. Las veces siguientes solo se lee.
//   El número lo calcula el servidor, así que no se puede trucar desde el enlace.
//
// Base de datos: Upstash Redis (Vercel > Storage). Usa las variables que crea
// la integración: KV_REST_API_URL / KV_REST_API_TOKEN, o sus equivalentes
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.

const crypto = require('crypto');

const TOKEN = /^[A-Za-z0-9]{6,16}$/;
const LIMITE_POR_HORA = 30; // eslabones nuevos por IP por hora

// Todo en un solo paso atómico dentro de Redis.
// KEYS: ninguna. ARGV: c, p, clave del límite, límite.
const SCRIPT = `
local c, p = ARGV[1], ARGV[2]
local n, nuevo = 1, 0
if c ~= '' then
  local k = 'cf:l:' .. c
  local ex = redis.call('HGET', k, 'n')
  if ex then
    n = tonumber(ex)
  else
    local usos = redis.call('INCR', ARGV[3])
    if usos == 1 then redis.call('EXPIRE', ARGV[3], 3600) end
    if usos <= tonumber(ARGV[4]) then
      n = 2
      local raiz = 1
      if p ~= '' then
        local pn = redis.call('HGET', 'cf:l:' .. p, 'n')
        if pn then n = tonumber(pn) + 1; raiz = 0 end
      end
      redis.call('HSET', k, 'n', n, 'p', p, 't', ARGV[5])
      redis.call('INCR', 'cf:total')
      if raiz == 1 then redis.call('INCR', 'cf:cadenas') end
      local m = tonumber(redis.call('GET', 'cf:max') or '1')
      if n > m then redis.call('SET', 'cf:max', n) end
      nuevo = 1
    else
      n = -1
    end
  end
end
return { n, nuevo,
  tonumber(redis.call('GET', 'cf:total') or '0'),
  tonumber(redis.call('GET', 'cf:max') or '1'),
  tonumber(redis.call('GET', 'cf:cadenas') or '0') }
`;

// Busca los datos de conexión. Vercel puede agregarle un prefijo a los nombres
// (por ejemplo STORAGE_KV_REST_API_URL), así que se aceptan con o sin prefijo.
function configuracion(env = process.env) {
  const nombres = Object.keys(env);
  for (const [sufUrl, sufToken] of [['KV_REST_API_URL', 'KV_REST_API_TOKEN'], ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']]) {
    for (const n of nombres) {
      if (!n.endsWith(sufUrl) || !env[n]) continue;
      const token = env[n.slice(0, -sufUrl.length) + sufToken];
      if (token) return { url: env[n].replace(/\/$/, ''), token };
    }
  }
  // Solo hay una dirección redis(s)://default:<token>@<host>.upstash.io:6379:
  // en Upstash, la API REST está en https://<host> y usa la misma clave.
  for (const n of nombres) {
    if (!/(REDIS_URL|KV_URL)$/.test(n) || !env[n]) continue;
    try {
      const u = new URL(env[n]);
      if (/^rediss?:$/.test(u.protocol) && u.hostname.endsWith('.upstash.io') && u.password) {
        return { url: 'https://' + u.hostname, token: decodeURIComponent(u.password) };
      }
    } catch (e) { /* no es una URL */ }
  }
  return null;
}

// Para diagnosticar: solo los NOMBRES de las variables relacionadas, nunca sus valores.
function variablesVistas(env = process.env) {
  return Object.keys(env).filter(n => /KV|REDIS|UPSTASH/.test(n)).sort();
}

module.exports = handler;
module.exports.configuracion = configuracion;

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'metodo' });
  }

  const db = configuracion();
  if (!db) return res.status(503).json({ error: 'sin-base', variables: variablesVistas() });

  const c = String(req.query.c || '');
  const p = String(req.query.p || '');
  if ((c && !TOKEN.test(c)) || (p && !TOKEN.test(p)) || (c && c === p)) {
    return res.status(400).json({ error: 'enlace' });
  }

  // La IP se guarda solo como hash, una hora, para frenar abusos.
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const claveLimite = 'cf:rl:' + crypto.createHash('sha256').update('cadena:' + ip).digest('hex').slice(0, 24);

  try {
    const r = await fetch(db.url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + db.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', SCRIPT, '0', c, p, claveLimite, String(LIMITE_POR_HORA), new Date().toISOString()]),
    });
    const datos = await r.json();
    if (!r.ok || datos.error) throw new Error(datos.error || 'HTTP ' + r.status);
    const [eslabon, nuevo, total, max, cadenas] = datos.result;
    if (eslabon === -1) return res.status(429).json({ error: 'limite', total, max, cadenas });
    return res.status(200).json({ eslabon, nuevo: nuevo === 1, total, max, cadenas });
  } catch (err) {
    console.error('cadena:', err.message);
    return res.status(502).json({ error: 'base' });
  }
}
