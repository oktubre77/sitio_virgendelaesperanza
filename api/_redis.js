// Conexión compartida a Upstash Redis por su API REST.
// Vercel no publica como ruta los archivos de /api que empiezan con "_".

const crypto = require('crypto');

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

async function pedir(db, ruta, cuerpo) {
  const r = await fetch(db.url + ruta, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + db.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json();
  if (!r.ok || datos.error) throw new Error(datos.error || 'HTTP ' + r.status);
  return datos;
}

// Un comando: redis(db, 'GET', 'clave')
async function redis(db, ...comando) {
  return (await pedir(db, '', comando.map(String))).result;
}

// Varios comandos juntos. Con atomico=true se aplican todos o ninguno.
async function varios(db, comandos, atomico = false) {
  const res = await pedir(db, atomico ? '/multi-exec' : '/pipeline', comandos.map(c => c.map(String)));
  return res.map(x => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

// HGETALL devuelve [k1, v1, k2, v2...]; esto lo pasa a objeto.
function aObjeto(lista) {
  if (lista && !Array.isArray(lista) && typeof lista === 'object') return lista;
  const o = {};
  for (let i = 0; i + 1 < (lista || []).length; i += 2) o[lista[i]] = lista[i + 1];
  return o;
}

// La IP se guarda solo como hash, para limitar abusos.
function claveIp(req, prefijo) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  return prefijo + crypto.createHash('sha256').update('cadena:' + ip).digest('hex').slice(0, 24);
}

// Suma un uso y dice si todavía está dentro del límite por hora.
async function dentroDelLimite(db, clave, limite) {
  const usos = await redis(db, 'INCR', clave);
  if (usos === 1) await redis(db, 'EXPIRE', clave, 3600);
  return usos <= limite;
}

module.exports = { configuracion, variablesVistas, redis, varios, aObjeto, claveIp, dentroDelLimite };
