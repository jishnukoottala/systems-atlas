// Shared page chrome. `base` is the relative path back to the repository root, so every
// link keeps working when the site is hosted below a repository subpath.
import { esc } from './markdown.mjs';

export const SITE_TITLE = 'Systems Atlas';
export const SITE_TAGLINE = 'Master system design from first principles to production';

// Runs before first paint so a stored theme never flashes. Without JavaScript the CSS
// prefers-color-scheme rules provide the system theme.
const THEME_BOOT = `<script>try{var s=JSON.parse(localStorage.getItem('principal-system-design-curriculum:v1')||'{}');if(s.theme==='light'||s.theme==='dark')document.documentElement.dataset.theme=s.theme}catch(e){}document.documentElement.classList.add('js')</script>`;

export function page({ base, title, description = '', body, bodyAttrs = '', mermaid = false, scripts = [] }) {
  const allScripts = ['progress.js', 'app.js', ...scripts];
  const mermaidTags = mermaid ? `<script defer src="${base}assets/mermaid.min.js"></script><script defer src="${base}assets/mermaid-init.js"></script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${THEME_BOOT}
<link rel="stylesheet" href="${base}assets/styles.css">
${allScripts.map((s) => `<script defer src="${base}assets/${s}"></script>`).join('')}${mermaidTags}
</head>
<body ${bodyAttrs}>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="${base}index.html">${SITE_TITLE}</a>
  <nav aria-label="Primary">
    <a href="${base}index.html">Curriculum</a>
    <a href="${base}systems-dissect/index.html">Systems</a>
    <a href="${base}traceability.html">Traceability</a>
  </nav>
  <label class="theme-control js-only">Theme
    <select id="theme-select"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
  </label>
</header>
${body}
<footer class="site-footer"><p>Educational material. Company names describe a class of system, not a private architecture.</p></footer>
</body>
</html>
`;
}
