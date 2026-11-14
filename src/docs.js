// Read-only access to the public Gyro developer docs (no API key needed). Data is cached for an hour.
export const DEFAULT_DOCS = 'https://www.gyrohosting.com/developers';
const TTL = 3600 * 1000;

export class Docs {
  constructor({ baseUrl = DEFAULT_DOCS, fetchImpl = fetch } = {}) {
    this.base = baseUrl.replace(/\/+$/, '');
    this.origin = new URL(this.base).origin;
    this.fetch = fetchImpl;
    this.cache = new Map();
  }

  async get(path, kind = 'json') {
    const url = path.startsWith('http') ? path : this.base + path;
    const c = this.cache.get(url);
    if (c && Date.now() - c.t < TTL) return c.v;
    const r = await this.fetch(url, { headers: { 'User-Agent': 'gyro-mcp' }, redirect: 'error' });
    if (!r.ok) { const e = new Error(`docs: ${r.status} for ${url}`); e.status = r.status; throw e; }
    const v = kind === 'json' ? await r.json() : await r.text();
    this.cache.set(url, { t: Date.now(), v });
    return v;
  }

  index(lang) { return this.get(`/assets/search-${lang === 'tr' ? 'tr' : 'en'}.json`); }

  products() { return this.get('/assets/products.json'); }

  /** Same scoring as the site's Ctrl K search. */
  async search(query, lang = 'en', limit = 10) {
    const idx = await this.index(lang);
    const raw = String(query || '').trim().toLowerCase();
    const ws = raw.split(/\s+/).filter(Boolean);
    if (!ws.length) return [];
    const fold = (s) => s.toLowerCase().replace(/ı/g, 'i').replace(/i̇/g, 'i');
    const scored = [];
    for (const x of idx) {
      const h = (x.t + ' ' + x.s + ' ' + x.k + ' ' + x.g).toLowerCase(); const tl = x.t.toLowerCase(); const sl = x.s.toLowerCase();
      let s = 0, miss = false;
      for (const w of ws) {
        if (h.indexOf(w) < 0 && fold(h).indexOf(fold(w)) < 0) { miss = true; break; }
        s += 10; if (tl.startsWith(w)) s += 25; else if (tl.includes(w)) s += 12; if (sl.includes(w)) s += 10;
        if (x.k.toLowerCase().split(' ').includes(w)) s += 8;
      }
      if (miss) continue;
      if (tl === raw || sl === raw || sl.slice(sl.indexOf(' ') + 1) === raw) s += 60;
      if (!x.m) s += 3;
      scored.push([s - x.t.length / 40, x]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, Math.min(Math.max(limit, 1), 30)).map(([, x]) => ({
      title: x.t, detail: x.s, section: x.g, method: x.m ? x.m.toUpperCase() : undefined,
      operation_id: x.m && x.u.includes('#') ? x.u.split('#')[1] : undefined,
      url: this.origin + x.u, markdown: this.origin + x.u.replace(/\.html(#|$)/, '.md$1'),
    }));
  }

  /** operation_id or "METHOD /path" → OpenAPI fragment + docs links. */
  async endpoint(ref, lang = 'en') {
    const idx = await this.index(lang);
    const ops = idx.filter((x) => x.m);
    let hit = ops.find((x) => x.u.endsWith('#' + ref));
    if (!hit) {
      const m = String(ref).trim().match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)$/i);
      if (m) {
        const norm = (p) => p.replace(/\{[^}]+\}/g, '{}').replace(/\/[0-9]+(?=\/|$)/g, '/{}');
        hit = ops.find((x) => { const [mm, pp] = x.s.split(' '); return mm === m[1].toUpperCase() && norm(pp) === norm(m[2]); });
      }
    }
    if (!hit) return null;
    const id = hit.u.split('#')[1];
    const fragment = await this.get(`/spec/ops/${encodeURIComponent(id)}.json`);
    return { operation_id: id, summary: hit.t, endpoint: hit.s, docs: this.origin + hit.u, docs_markdown: this.origin + hit.u.replace('.html#', '.md#'), openapi: fragment };
  }

  /** A docs page as Markdown. Only pages under the docs base are allowed. */
  async page(urlOrPath) {
    let u;
    try { u = new URL(urlOrPath, this.base + '/'); } catch { throw new Error('Give a docs URL or a path like en/guides/errors.md'); }
    if (u.origin !== this.origin || !u.pathname.startsWith(new URL(this.base).pathname + '/')) throw new Error('Only pages under ' + this.base + '/ can be read.');
    let p = u.pathname.replace(/\/$/, '/index.html').replace(/\.html$/, '.md');
    if (!/\.(md|txt)$/.test(p)) p += '.md';
    return this.get(this.origin + p, 'text');
  }
}
