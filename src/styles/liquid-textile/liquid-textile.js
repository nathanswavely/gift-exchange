/**
 * Liquid Textile — Optional JS Companion
 *
 * Enhances the pure-CSS framework with per-element randomness.
 * All functions are optional — the CSS classes work without this file.
 *
 * Usage:
 *   import { applyTexture, applyRawEdge, applyDistort } from './liquid-textile.js';
 *   applyTexture(element, { type: 'crumple', seed: 42 });
 *   applyRawEdge(element, { seed: 'my-id' });
 *   applyDistort(element, { seed: 'my-id', intensity: 0.4 });
 */

// --- Seeded random number generator (deterministic) ---

function seededRng(seed) {
  let s = typeof seed === 'string' ? hashStr(seed) : seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// --- Theme detection ---

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function tint(opacity) {
  return isDark()
    ? `rgba(255,255,255,${opacity})`
    : `rgba(0,0,0,${opacity})`;
}

// --- TEXTURE: seeded gradient generation ---

const TEXTURE_GENERATORS = {
  crumple(rng, complexity) {
    const count = 3 + Math.floor(complexity * 4); // 3-7 radial blobs
    const layers = [];
    for (let i = 0; i < count; i++) {
      const x = (rng() * 80 + 10).toFixed(0);
      const y = (rng() * 80 + 10).toFixed(0);
      const rx = (rng() * 40 + 30).toFixed(0);
      const ry = (rng() * 40 + 20).toFixed(0);
      const op = (0.01 + rng() * 0.025 * complexity).toFixed(3);
      const fade = (55 + rng() * 20).toFixed(0);
      layers.push(`radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%, ${tint(op)} 0%, transparent ${fade}%)`);
    }
    return layers.join(', ');
  },

  drape(rng, complexity) {
    const count = 2 + Math.floor(complexity * 3);
    const layers = [];
    for (let i = 0; i < count; i++) {
      const angle = (160 + rng() * 40).toFixed(0);
      const start = (35 + rng() * 15).toFixed(0);
      const op = (0.015 + rng() * 0.02 * complexity).toFixed(3);
      const width = (6 + rng() * 8).toFixed(0);
      const size = (150 + rng() * 200).toFixed(0);
      layers.push(`linear-gradient(${angle}deg, transparent ${start}%, ${tint(op)} ${+start + +width / 2}%, transparent ${+start + +width}%)`);
    }
    const sizes = layers.map((_, i) => `100% ${(150 + (i * 47 + seededRng(i + 99)() * 80)).toFixed(0)}px`).join(', ');
    return { image: layers.join(', '), size: sizes };
  },

  rumple(rng, complexity) {
    const count = 3 + Math.floor(complexity * 3);
    const layers = [];
    const sizes = [];
    for (let i = 0; i < count; i++) {
      const angle = (rng() * 360).toFixed(0);
      const start = (25 + rng() * 25).toFixed(0);
      const op = (0.01 + rng() * 0.025 * complexity).toFixed(3);
      const width = (8 + rng() * 12).toFixed(0);
      layers.push(`linear-gradient(${angle}deg, transparent ${start}%, ${tint(op)} ${+start + +width / 2}%, transparent ${+start + +width}%)`);
      const w = (250 + rng() * 250).toFixed(0);
      const h = (250 + rng() * 250).toFixed(0);
      sizes.push(`${w}px ${h}px`);
    }
    return { image: layers.join(', '), size: sizes.join(', ') };
  },

  grain(rng, complexity) {
    const angle1 = (88 + rng() * 8).toFixed(0);
    const angle2 = (-2 + rng() * 8).toFixed(0);
    const op1 = (0.008 + complexity * 0.01).toFixed(3);
    const op2 = (0.005 + complexity * 0.008).toFixed(3);
    const gap1 = (3 + rng() * 2).toFixed(0);
    const gap2 = (4 + rng() * 2).toFixed(0);
    return `repeating-linear-gradient(${angle1}deg, transparent 0px, ${tint(op1)} 1px, transparent 2px, transparent ${gap1}px), repeating-linear-gradient(${angle2}deg, transparent 0px, ${tint(op2)} 1px, transparent 2px, transparent ${gap2}px)`;
  },
};

/**
 * Apply a seeded texture to an element.
 * @param {HTMLElement} node
 * @param {{ type?: string, seed?: number|string, complexity?: number }} opts
 */
export function applyTexture(node, opts = {}) {
  const { type = 'crumple', seed = Math.random() * 10000, complexity = 0.5 } = opts;
  const gen = TEXTURE_GENERATORS[type];
  if (!gen) return;

  const rng = seededRng(seed);
  const result = gen(rng, Math.max(0, Math.min(1, complexity)));

  if (typeof result === 'string') {
    node.style.backgroundImage = result;
  } else {
    node.style.backgroundImage = result.image;
    node.style.backgroundSize = result.size;
  }
}

// --- RAW EDGE: generated clip-path polygon ---

/**
 * Generate a unique raw edge clip-path from a seed.
 *
 * For an element that stands alone. `seam: true` only pushes the wobble
 * outward so neighbours overlap instead of gapping; it does not make two
 * neighbours share one edge, and Patchwork retired per-tile edges on its
 * quilt for that reason (see raw.css).
 * @param {{ seed?: number|string, intensity?: number, points?: number, seam?: boolean }} opts
 * @returns {string} CSS clip-path polygon value
 */
export function generateRawEdge(opts = {}) {
  const { seed = Math.random() * 10000, intensity = 0.8, points = 12, seam = false } = opts;
  const rng = seededRng(seed);

  // Generate points around the rectangle perimeter.
  // Each edge gets points/4 points evenly spaced, each deviated slightly.
  // intensity maps to edge deviation: 0.8 (default) ≈ ±2.4% of the element,
  // clearly hand-cut on a card; ~0.3 matches the subtle lt-raw-* CSS presets.
  const ppSide = Math.max(2, Math.floor(points / 4));
  const coords = [];
  const maxDev = intensity * 3; // max percentage deviation
  const cap = Math.max(2, maxDev); // clamp bound follows intensity

  // Top edge (left to right)
  for (let i = 0; i < ppSide; i++) {
    const t = i / (ppSide - 1); // 0 to 1
    const x = t * 100;
    const dev = (rng() - (seam ? 0 : 0.5)) * maxDev;
    const y = seam ? Math.min(0, dev) : dev;
    coords.push(`${clamp(x + (rng() - 0.5) * maxDev * 0.3, 0, 100)}% ${clamp(y, -cap, cap)}%`);
  }

  // Right edge (top to bottom)
  for (let i = 0; i < ppSide; i++) {
    const t = i / (ppSide - 1);
    const y = t * 100;
    const dev = (rng() - (seam ? 0 : 0.5)) * maxDev;
    const x = 100 + (seam ? Math.max(0, dev) : dev);
    coords.push(`${clamp(x, 100 - cap, 100 + cap)}% ${clamp(y + (rng() - 0.5) * maxDev * 0.3, 0, 100)}%`);
  }

  // Bottom edge (right to left)
  for (let i = 0; i < ppSide; i++) {
    const t = i / (ppSide - 1);
    const x = (1 - t) * 100;
    const dev = (rng() - (seam ? 0 : 0.5)) * maxDev;
    const y = 100 + (seam ? Math.max(0, dev) : dev);
    coords.push(`${clamp(x + (rng() - 0.5) * maxDev * 0.3, 0, 100)}% ${clamp(y, 100 - cap, 100 + cap)}%`);
  }

  // Left edge (bottom to top)
  for (let i = 0; i < ppSide; i++) {
    const t = i / (ppSide - 1);
    const y = (1 - t) * 100;
    const dev = (rng() - (seam ? 0 : 0.5)) * maxDev;
    const x = seam ? Math.min(0, dev) : dev;
    coords.push(`${clamp(x, -cap, cap)}% ${clamp(y + (rng() - 0.5) * maxDev * 0.3, 0, 100)}%`);
  }

  return `polygon(${coords.join(', ')})`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, +v.toFixed(2)));
}

/**
 * Apply a generated raw edge to an element.
 */
export function applyRawEdge(node, opts = {}) {
  node.style.clipPath = generateRawEdge(opts);
}

// --- STITCH: unique dash patterns ---

/**
 * Generate a unique stitch border-image SVG from a seed.
 */
export function applyStitch(node, opts = {}) {
  const { seed = Math.random() * 10000, weight = 1, type = 'stitch' } = opts;
  const rng = seededRng(seed);
  const dark = isDark();
  const color = dark ? '%23e8e6e3' : '%232d2a26';
  const opacity = dark ? '0.35' : '0.45';

  // Generate random dash array.
  let dashes;
  if (type === 'baste') {
    // Short dashes, big gaps.
    dashes = Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? (1 + rng() * 2).toFixed(0) : (5 + rng() * 6).toFixed(0)
    ).join(' ');
  } else {
    // Varied dashes and gaps.
    dashes = Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? (4 + rng() * 6).toFixed(0) : (2 + rng() * 4).toFixed(0)
    ).join(' ');
  }

  const svg = `%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect x='1' y='1' width='38' height='38' fill='none' stroke='${color}' stroke-width='${weight}' stroke-dasharray='${dashes}' stroke-linecap='round' opacity='${opacity}'/%3E%3C/svg%3E`;

  node.style.border = `${weight}px solid transparent`;
  node.style.borderImage = `url("data:image/svg+xml,${svg}") ${weight} round`;
}

// --- AUTO RAW: assign variant from index or id ---

/**
 * Automatically assign a raw edge class based on index or ID.
 * Convenience for lists/grids where you want varied edges.
 */
export function applyAutoRaw(node, opts = {}) {
  const { index, id, seam = false } = opts;
  let n;
  if (index !== undefined) {
    n = index;
  } else if (id) {
    n = hashStr(String(id));
  } else {
    n = Math.floor(Math.random() * 5);
  }
  const variant = (Math.abs(n) % 5) + 1;
  // Remove any existing raw classes.
  for (let i = 1; i <= 5; i++) {
    node.classList.remove(`lt-raw-${i}`, `lt-raw-seam-${i}`);
  }
  node.classList.add(`lt-raw-${variant}`);
  if (seam) node.classList.add('lt-seam');
}

// --- DISTORT: SVG turbulence filter for fabric-like warping ---

// Shared SVG container for filter definitions (created once, reused).
let _filterSvg = null;
function getFilterSvg() {
  if (_filterSvg) return _filterSvg;
  _filterSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  _filterSvg.setAttribute('width', '0');
  _filterSvg.setAttribute('height', '0');
  _filterSvg.setAttribute('aria-hidden', 'true');
  _filterSvg.style.position = 'absolute';
  _filterSvg.style.pointerEvents = 'none';
  document.body.appendChild(_filterSvg);
  return _filterSvg;
}

/**
 * Apply a seeded turbulence distortion filter to an element.
 * Makes text and content warp as if printed/embroidered on uneven fabric.
 *
 * @param {HTMLElement} node
 * @param {{ seed?: number|string, intensity?: number, scale?: number }} opts
 *   - seed: deterministic turbulence pattern (default: random)
 *   - intensity: 0-1, how much warping (default: 0.4)
 *   - scale: displacement in px (default: auto from intensity)
 */
export function applyDistort(node, opts = {}) {
  const { seed = Math.random() * 10000, intensity = 0.4 } = opts;
  const numSeed = typeof seed === 'string' ? hashStr(seed) : Math.floor(seed);
  const scale = opts.scale ?? (1 + intensity * 3); // 1-4px displacement
  const freq = (0.015 + intensity * 0.02).toFixed(4); // turbulence frequency

  const filterId = `lt-distort-${numSeed}`;

  // Check if this filter already exists
  if (!document.getElementById(filterId)) {
    const svg = getFilterSvg();
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', filterId);
    // Extend filter region to avoid clipping at edges
    filter.setAttribute('x', '-5%');
    filter.setAttribute('y', '-5%');
    filter.setAttribute('width', '110%');
    filter.setAttribute('height', '110%');

    const turbulence = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
    turbulence.setAttribute('type', 'turbulence');
    turbulence.setAttribute('baseFrequency', `${freq} ${(+freq * 0.8).toFixed(4)}`);
    turbulence.setAttribute('numOctaves', '3');
    turbulence.setAttribute('seed', String(numSeed % 1000));
    turbulence.setAttribute('result', 'noise');

    const displace = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    displace.setAttribute('in', 'SourceGraphic');
    displace.setAttribute('in2', 'noise');
    displace.setAttribute('scale', String(scale.toFixed(1)));
    displace.setAttribute('xChannelSelector', 'R');
    displace.setAttribute('yChannelSelector', 'G');

    filter.appendChild(turbulence);
    filter.appendChild(displace);
    svg.appendChild(filter);
  }

  node.style.filter = `url(#${filterId})`;
}
