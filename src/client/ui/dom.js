// Tiny DOM/SVG builders. h('div.cls#id', { attrs, on: { click } }, ...children)

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'circle', 'path', 'line', 'rect', 'text', 'polygon', 'polyline', 'ellipse', 'defs', 'marker', 'title']);

export function h(spec, attrs = {}, ...children) {
  const [, tag = 'div', rest = ''] = spec.match(/^([a-z0-9]+)?(.*)$/i);
  const svg = SVG_TAGS.has(tag);
  const el = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [, kind, name] of rest.matchAll(/([.#])([\w-]+)/g)) {
    if (kind === '.') el.classList.add(name); else el.id = name;
  }
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (val === undefined) continue;
        if (prop.startsWith('--')) el.style.setProperty(prop, val); else el.style[prop] = val;
      }
    }
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (!svg && k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
export const pct = (p) => `${Math.round(p * 100)}%`;

// persisted per-viewer preferences; storage can be unavailable (private mode, itch iframe quirks)
export const prefs = {
  get(key, fallback) {
    try { const v = localStorage.getItem(`brisque:${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`brisque:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  },
};
