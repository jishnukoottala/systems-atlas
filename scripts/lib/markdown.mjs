// Small dependency-free Markdown renderer for the curriculum's authored content.md files.
// Supports headings, paragraphs, lists, tables, fences, quotes, and the :::containers
// documented in README.md. It also returns extracted diagrams, challenges, and counts.

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const slugId = (s) => s.toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function inline(text, ctx) {
  const stash = [];
  const hold = (html) => { stash.push(html); return `\u0000${stash.length - 1}\u0000`; };
  let s = text.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
  s = s.replace(/\[\[([oa]\d+)\]\]/g, (_, id) => hold(ctx.xref(id)));
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+|[^)\s]+)\)/g, (_, label, url) => {
    const ext = /^https?:/.test(url);
    return hold(`<a href="${esc(url)}"${ext ? ' rel="noopener noreferrer"' : ''}>${esc(label)}</a>`);
  });
  s = esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
}

const isBlockStart = (l) => /^(#{2,4} |```|:::|\| |> |- |\d+\. )/.test(l);

export function renderBlocks(src, ctx) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{2,4}) (.+)$/))) {
      const level = m[1].length;
      const id = `${ctx.prefix ?? ''}${slugId(m[2])}`;
      ctx.headings.push({ level, text: m[2], id });
      out.push(`<h${level} id="${id}">${inline(m[2], ctx)}</h${level}>`);
      i++;
    } else if (line.startsWith('```')) {
      const info = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      if (info.startsWith('mermaid')) {
        const [name, title, desc] = info.slice(7).split('|').map((x) => x.trim());
        const source = body.join('\n');
        ctx.diagrams.push({ name, title, desc, source });
        out.push(`<figure class="diagram" id="diagram-${name}"><figcaption>${inline(title, ctx)}</figcaption>`
          + `<pre class="mermaid" role="img" aria-label="${esc(desc)}">${esc(source)}</pre>`
          + `<p class="diagram-alt"><strong>Text alternative.</strong> ${inline(desc, ctx)}</p></figure>`);
      } else {
        out.push(`<pre class="code"><code${info ? ` class="language-${esc(info)}"` : ''}>${esc(body.join('\n'))}</code></pre>`);
      }
    } else if ((m = line.match(/^:::(\w+)\s*(.*)$/))) {
      const body = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') body.push(lines[i++]);
      i++;
      out.push(renderContainer(m[1], m[2].trim(), body.join('\n'), ctx));
    } else if (line.startsWith('| ')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
      const head = cells(rows[0]).map((c) => `<th scope="col">${inline(c, ctx)}</th>`).join('');
      const rest = rows.slice(2).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c, ctx)}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rest}</tbody></table></div>`);
    } else if (line.startsWith('> ')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('> ')) q.push(lines[i++].slice(2));
      out.push(`<blockquote>${renderBlocks(q.join('\n'), ctx)}</blockquote>`);
    } else if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const ordered = !line.startsWith('- ');
      const re = ordered ? /^\d+\. / : /^- /;
      const items = [];
      while (i < lines.length && (re.test(lines[i]) || /^ {2,}\S/.test(lines[i]))) {
        if (re.test(lines[i])) items.push(lines[i].replace(re, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      const check = items.every((t) => t.startsWith('[ ] '));
      const lis = items.map((t) => `<li>${inline(t.replace(/^\[ \] /, ''), ctx)}</li>`).join('');
      out.push(`<${ordered ? 'ol' : 'ul'}${check ? ' class="checklist"' : ''}>${lis}</${ordered ? 'ol' : 'ul'}>`);
    } else {
      const p = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) p.push(lines[i++]);
      out.push(`<p>${inline(p.join(' '), ctx)}</p>`);
    }
  }
  return out.join('\n');
}

function renderContainer(kind, args, body, ctx) {
  if (kind === 'details') {
    return `<details class="disclosure"><summary>${inline(args, ctx)}</summary>${renderBlocks(body, ctx)}</details>`;
  }
  if (kind === 'note') {
    return `<aside class="note"><p class="note-label">${inline(args || 'Note', ctx)}</p>${renderBlocks(body, ctx)}</aside>`;
  }
  if (kind === 'q') {
    const [level, question] = args.split('|').map((x) => x.trim());
    ctx.questions.push({ level: level.toLowerCase(), question, body });
    return `<details class="qa"><summary><span class="tag">${esc(level)}</span> ${inline(question, ctx)}</summary>${renderBlocks(body, ctx)}</details>`;
  }
  if (kind === 'failure') {
    ctx.failures.push({ name: args, body });
    const rows = body.split('\n').filter(Boolean).map((l) => {
      const at = l.indexOf(':');
      return `<dt>${esc(l.slice(0, at))}</dt><dd>${inline(l.slice(at + 1).trim(), ctx)}</dd>`;
    }).join('');
    return `<div class="failure"><h3 id="failure-${slugId(args)}">${inline(args, ctx)}</h3><dl>${rows}</dl></div>`;
  }
  if (kind === 'challenge') {
    const [type, title] = args.split('|').map((x) => x.trim());
    const parts = body.split(/^>>> /m);
    const prompt = parts[0].trim();
    const named = {};
    for (const p of parts.slice(1)) {
      const nl = p.indexOf('\n');
      named[p.slice(0, nl).trim().toLowerCase()] = p.slice(nl + 1).trim();
    }
    ctx.challenges.push({ type: type.toLowerCase(), title, prompt, ...named });
    const disc = (label, key) => (named[key] ? `<details class="disclosure"><summary>${label}</summary>${renderBlocks(named[key], ctx)}</details>` : '');
    return `<div class="challenge"><h3 id="challenge-${slugId(type)}"><span class="tag">${esc(type)}</span> ${inline(title, ctx)}</h3>${renderBlocks(prompt, ctx)}${disc('Hint', 'hint')}${disc('Solution', 'solution')}${disc('Common mistakes', 'common mistakes')}</div>`;
  }
  if (kind === 'quiz') {
    const lines = body.split('\n').filter(Boolean);
    const options = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
    const explain = lines.filter((l) => !l.startsWith('- ')).join(' ');
    const correct = options.findIndex((o) => o.startsWith('*'));
    const n = ctx.quiz.length;
    ctx.quiz.push({ question: args, options, correct, explain });
    const opts = options.map((o, k) => `<label><input type="radio" name="quiz-${n}" value="${k}"> ${inline(o.replace(/^\*/, ''), ctx)}</label>`).join('');
    return `<form class="quiz" data-correct="${correct}"><fieldset><legend>${n + 1}. ${inline(args, ctx)}</legend>${opts}<p class="quiz-feedback" role="status" aria-live="polite"></p>`
      + `<details class="disclosure"><summary>Answer and explanation</summary><p><strong>Answer:</strong> ${inline(options[correct].replace(/^\*/, ''), ctx)}.</p><p>${inline(explain, ctx)}</p></details></fieldset></form>`;
  }
  throw new Error(`Unknown container :::${kind}`);
}

export const newContext = (xref) => ({ xref, headings: [], diagrams: [], questions: [], failures: [], challenges: [], quiz: [] });
