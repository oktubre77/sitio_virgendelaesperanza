// Lee los RSS de Vatican News desde el servidor y los devuelve como JSON.
//
// GET /api/rss?feed=lectio     → evangelio y lecturas del día
// GET /api/rss?feed=noticias   → noticias de Vatican News en español
//
// Antes la página dependía solo de api.rss2json.com, un servicio gratuito de
// terceros con límite de pedidos diarios: cuando se agotaba, la Lectio mostraba
// "No pudimos cargar las lecturas de hoy". Ahora el pedido lo hace Vercel y la
// respuesta queda en caché (CDN), así que Vatican News recibe pocas visitas.
//
// La respuesta tiene la misma forma que rss2json ({ status, items: [...] }) para
// que la página pueda usar una u otra fuente sin cambiar nada más.

const FEEDS = {
  lectio: 'https://www.vaticannews.va/es/evangelio-de-hoy.rss.xml',
  noticias: 'https://www.vaticannews.va/es.rss.xml',
};

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodificar(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : todo;
    }
    const v = ENTIDADES[e.toLowerCase()];
    return v === undefined ? todo : v;
  });
}

// Contenido de una etiqueta: con CDATA se usa tal cual; si no, viene escapado.
function etiqueta(xml, nombre) {
  const m = xml.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, 'i'));
  if (!m) return '';
  const crudo = m[1].trim();
  const cdata = crudo.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1].trim() : decodificar(crudo);
}

function enclosure(xml) {
  const m = xml.match(/<enclosure\b[^>]*\burl=["']([^"']+)["']/i);
  return m ? decodificar(m[1]) : '';
}

function parsear(xml) {
  const items = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < 30) {
    const it = m[1];
    items.push({
      title: etiqueta(it, 'title'),
      link: etiqueta(it, 'link'),
      pubDate: etiqueta(it, 'pubDate'),
      description: etiqueta(it, 'description'),
      content: etiqueta(it, 'content:encoded'),
      enclosure: { link: enclosure(it) },
    });
  }
  return items;
}

module.exports = async (req, res) => {
  const feed = String((req.query && req.query.feed) || '');
  const url = FEEDS[feed];
  if (!url) {
    res.status(400).json({ status: 'error', message: 'feed desconocido' });
    return;
  }

  try {
    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), 8000);
    let r;
    try {
      r = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PeregrinosDeLaEsperanza/1.0; +https://www.peregrinosdelaesperanza.org)',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      });
    } finally {
      clearTimeout(corte);
    }
    if (!r.ok) throw new Error(`Vatican News respondió HTTP ${r.status}`);

    const items = parsear(await r.text());
    if (!items.length) throw new Error('El feed no trae items');

    // 30 min fresco en la CDN; si Vatican News falla, se sirve la copia anterior hasta 1 día.
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400, stale-if-error=86400');
    res.status(200).json({ status: 'ok', items });
  } catch (error) {
    console.error('api/rss', feed, error && error.message);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ status: 'error', message: 'No se pudo leer el feed' });
  }
};
