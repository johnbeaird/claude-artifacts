#!/usr/bin/env node
/**
 * generate-index.js
 * --------------------------------------------------------------
 * Scans ./public for HTML artifacts and writes ./public/index.html
 * Runs as part of the Cloudflare deploy command. No npm deps.
 *
 *   Top-level files:        public/<name>.html       -> /<name>.html
 *   Folder w/ index.html:   public/<slug>/index.html -> /<slug>/
 *
 * Titles are pulled from each file's <title> tag; falls back to
 * the slug if absent. List is sorted newest-first by mtime.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT = path.join(PUBLIC_DIR, 'index.html');

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function extractTitle(filePath, fallback) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const m = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m && m[1].trim()) return m[1].trim().replace(/\s+/g, ' ');
  } catch (e) { /* fall through */ }
  return fallback;
}

function collectArtifacts() {
  const items = [];
  const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'index.html') continue;

    const full = path.join(PUBLIC_DIR, entry.name);

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      const stat = fs.statSync(full);
      items.push({
        title: extractTitle(full, entry.name.replace(/\.html$/i, '')),
        href: '/' + entry.name,
        slug: entry.name,
        mtime: stat.mtime,
      });
    } else if (entry.isDirectory()) {
      const indexFile = path.join(full, 'index.html');
      if (fs.existsSync(indexFile)) {
        const stat = fs.statSync(indexFile);
        items.push({
          title: extractTitle(indexFile, entry.name),
          href: '/' + entry.name + '/',
          slug: entry.name + '/',
          mtime: stat.mtime,
        });
      }
    }
  }

  items.sort((a, b) => b.mtime - a.mtime);
  return items;
}

const fmtDate = d => d.toISOString().slice(0, 10);
const pad = (n, w) => String(n).padStart(w, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function render(items) {
  const buildTime = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';
  const count = items.length;

  const lastUpdated = count > 0 ? fmtDate(items[0].mtime) : '—';

  const rows = count === 0
    ? `<div class="empty">
         <div class="empty-mark">∅</div>
         <p>No artifacts yet.</p>
         <p class="empty-hint">Drop an HTML file into <code>/public</code> and push — it'll appear here.</p>
       </div>`
    : items.map((item, i) => `
        <a class="artifact" href="${esc(item.href)}">
          <div class="artifact-num">${pad(count - i, 3)}</div>
          <div class="artifact-body">
            <h2 class="artifact-title">${esc(item.title)}</h2>
            <div class="artifact-meta">
              <span class="artifact-slug">${esc(item.slug)}</span>
              <span class="artifact-sep">·</span>
              <span class="artifact-date">${fmtDate(item.mtime)}</span>
            </div>
          </div>
          <div class="artifact-arrow">→</div>
        </a>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Big House Lab · Artifacts</title>
  <meta name="description" content="A working catalog of experiments, briefings, and built things from Big House Lab.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..900,0..100,0..1;1,9..144,300..900,0..100,0..1&family=Geist+Mono:wght@300..600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #100c08;
      --bg-elev: #1a1410;
      --fg: #ece4d4;
      --fg-dim: #8a7f6f;
      --fg-meta: #5d5446;
      --accent: #d4773a;
      --accent-soft: #d4773a30;
      --line: #2a221b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: var(--bg);
      color: var(--fg);
      font-family: 'Geist Mono', ui-monospace, 'SF Mono', monospace;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      background-image:
        radial-gradient(ellipse 80% 50% at 50% -10%, #1f1812 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 90% 80%, #1a1108 0%, transparent 70%);
      position: relative;
    }
    body::before {
      content: '';
      position: fixed; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2' /%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 0;
      mix-blend-mode: overlay;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: clamp(2rem, 5vw, 5rem) clamp(1.5rem, 4vw, 3rem);
      position: relative;
      z-index: 1;
    }

    .header {
      padding-bottom: 4rem;
      border-bottom: 1px solid var(--line);
      margin-bottom: 3rem;
      position: relative;
    }
    .eyebrow {
      font-size: 0.7rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 2.5rem;
    }
    .eyebrow::before {
      content: '';
      display: inline-block;
      width: 1.5rem; height: 1px;
      background: var(--accent);
    }
    .title {
      font-family: 'Fraunces', serif;
      font-weight: 300;
      font-style: italic;
      font-size: clamp(4rem, 13vw, 9.5rem);
      line-height: 0.88;
      letter-spacing: -0.04em;
      font-variation-settings: 'SOFT' 50, 'WONK' 1, 'opsz' 144;
      margin-bottom: 1.5rem;
    }
    .title-dot { color: var(--accent); font-style: normal; }
    .subtitle {
      font-family: 'Fraunces', serif;
      font-style: italic;
      font-weight: 300;
      font-size: clamp(1.05rem, 1.6vw, 1.3rem);
      color: var(--fg-dim);
      max-width: 32em;
      line-height: 1.45;
      margin-bottom: 2.5rem;
    }
    .stats {
      display: flex;
      gap: 2.5rem;
      font-size: 0.7rem;
      color: var(--fg-meta);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      flex-wrap: wrap;
    }
    .stat-label { display: block; margin-bottom: 0.4rem; }
    .stat-value {
      color: var(--fg);
      font-size: 1rem;
      letter-spacing: 0.05em;
    }

    .list { display: flex; flex-direction: column; }
    .artifact {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 2rem;
      align-items: center;
      padding: 1.75rem 0;
      border-bottom: 1px solid var(--line);
      text-decoration: none;
      color: inherit;
      position: relative;
      transition: padding-left 0.35s cubic-bezier(.2,.7,.2,1);
    }
    .artifact::before {
      content: '';
      position: absolute;
      left: -1.5rem; top: 50%;
      width: 0.5rem; height: 1px;
      background: var(--accent);
      transform: scaleX(0);
      transform-origin: right;
      transition: transform 0.3s ease;
    }
    .artifact:hover {
      padding-left: 1.25rem;
    }
    .artifact:hover::before { transform: scaleX(1); transform-origin: left; }
    .artifact:hover .artifact-title { color: var(--accent); }
    .artifact:hover .artifact-arrow {
      color: var(--accent);
      transform: translateX(0.5rem);
    }

    .artifact-num {
      font-size: 0.7rem;
      color: var(--fg-meta);
      letter-spacing: 0.1em;
      align-self: start;
      padding-top: 0.6rem;
      font-feature-settings: 'tnum';
    }
    .artifact-title {
      font-family: 'Fraunces', serif;
      font-weight: 400;
      font-style: normal;
      font-size: clamp(1.4rem, 2.6vw, 2rem);
      line-height: 1.15;
      letter-spacing: -0.015em;
      transition: color 0.25s ease;
      margin-bottom: 0.5rem;
      font-variation-settings: 'SOFT' 30, 'opsz' 60;
    }
    .artifact-meta {
      display: flex;
      gap: 0.6rem;
      font-size: 0.7rem;
      color: var(--fg-meta);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      align-items: center;
      flex-wrap: wrap;
    }
    .artifact-slug { color: var(--fg-dim); }
    .artifact-sep { opacity: 0.5; }
    .artifact-arrow {
      font-family: 'Fraunces', serif;
      font-size: 1.6rem;
      color: var(--fg-meta);
      transition: all 0.3s ease;
      font-weight: 300;
    }

    .empty {
      padding: 6rem 0;
      text-align: center;
      color: var(--fg-dim);
    }
    .empty-mark {
      font-family: 'Fraunces', serif;
      font-size: 4rem;
      color: var(--accent);
      opacity: 0.5;
      margin-bottom: 1.5rem;
      font-style: italic;
    }
    .empty p {
      font-family: 'Fraunces', serif;
      font-style: italic;
      font-size: 1.3rem;
      margin-bottom: 0.5rem;
    }
    .empty-hint {
      font-family: 'Geist Mono', monospace !important;
      font-style: normal !important;
      font-size: 0.8rem !important;
      color: var(--fg-meta);
      margin-top: 1rem !important;
    }
    .empty-hint code {
      color: var(--accent);
      background: var(--accent-soft);
      padding: 0.1rem 0.4rem;
      border-radius: 2px;
    }

    .footer {
      margin-top: 5rem;
      padding-top: 2rem;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.65rem;
      color: var(--fg-meta);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .footer a {
      color: var(--fg-dim);
      text-decoration: none;
      border-bottom: 1px solid var(--line);
      padding-bottom: 1px;
      transition: all 0.2s ease;
    }
    .footer a:hover { color: var(--accent); border-color: var(--accent); }

    @media (max-width: 640px) {
      .artifact { gap: 1rem; grid-template-columns: auto 1fr; }
      .artifact-arrow { display: none; }
      .stats { gap: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="eyebrow">Big House Lab</div>
      <h1 class="title">Artifacts<span class="title-dot">.</span></h1>
      <p class="subtitle">A working catalog of experiments, briefings, and built things — assembled on the fly, shipped as they're made.</p>
      <div class="stats">
        <div>
          <span class="stat-label">Count</span>
          <span class="stat-value">${pad(count, 3)}</span>
        </div>
        <div>
          <span class="stat-label">Last update</span>
          <span class="stat-value">${lastUpdated}</span>
        </div>
        <div>
          <span class="stat-label">Built</span>
          <span class="stat-value">${buildTime}</span>
        </div>
      </div>
    </header>

    <main class="list">
      ${rows}
    </main>

    <footer class="footer">
      <span>Big House Lab // ${new Date().getFullYear()}</span>
      <span><a href="https://escapepoorthinking.com">escapepoorthinking.com</a></span>
    </footer>
  </div>
</body>
</html>`;
}

const artifacts = collectArtifacts();
const html = render(artifacts);
fs.writeFileSync(OUTPUT, html);
console.log(`✓ Generated ${path.relative(process.cwd(), OUTPUT)} with ${artifacts.length} artifact(s).`);
