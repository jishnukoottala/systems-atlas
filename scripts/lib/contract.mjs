// The content contract every authored page must satisfy before it can be marked complete.
export const TOPIC_SECTIONS = [
  ['Orientation', ['Definition', 'Why it matters', 'Learning objectives']],
  ['Production scenario', []],
  ['Mental model', ['Analogy', 'Where the analogy breaks', 'Entities, state, flow, and invariants']],
  ['Foundations', ['Concepts and terminology', 'First-principles explanation', 'Mathematics', 'Complexity']],
  ['Mechanism', ['Normal path', 'State transitions', 'Concurrency behavior', 'Ordering and consistency', 'Ownership of data and control']],
  ['Architecture', []],
  ['Trade-offs', ['Advantages', 'Costs', 'Alternatives', 'When to use it', 'When not to use it', 'Reconsider when']],
  ['Capacity planning', ['Inputs and assumptions', 'Formula and units', 'Intermediate calculations', 'Headroom', 'Failure capacity']],
  ['Failure modes', []],
  ['Security and privacy', ['Threats', 'Trust boundaries', 'Authentication and authorization', 'Tenant isolation', 'Sensitive data', 'Abuse resistance']],
  ['Observability', ['Metrics', 'Logs', 'Traces', 'Dashboards', 'Alerts', 'SLO examples', 'Runbook actions']],
  ['Implementation', ['Architecture of the examples', 'Data structures', 'Interfaces', 'Error handling', 'Concurrency considerations', 'Educational limitations', 'Production hardening']],
  ['Terminal lab', ['Setup', 'Run', 'Test', 'Expected output', 'Cleanup', 'Troubleshooting']],
  ['Practical challenges', []],
  ['Industry standards and trends', ['Standards and specifications', 'Established practice', 'Managed-service options', 'Emerging approaches', 'Recent changes', 'Adoption constraints']],
  ['Interview preparation', []],
  ['Review', ['Key takeaways', 'Decision checklist', 'Production-readiness checklist', 'Glossary', 'Quiz', 'Further study']],
];
export const SYSTEM_SECTIONS = [
  'Clarifying questions', 'Functional requirements', 'Non-functional requirements', 'Explicit assumptions',
  'Capacity estimates', 'API or event contracts', 'Data model', 'High-level architecture',
  'Critical request and event flows', 'Deep dives', 'Scaling reads', 'Scaling writes', 'Partitioning strategy',
  'Caching strategy', 'Consistency requirements', 'Concurrency and contention', 'Failure modes',
  'Multi-region strategy', 'Security and abuse prevention', 'Observability and SLOs', 'Cost model',
  'Evolution from MVP to global scale', 'Alternative designs', 'Interviewer follow-up questions',
  'Principal-level trade-off discussion', 'Runnable focused examples',
].map((s) => [s, []]);
export const TOPIC_DIAGRAMS = ['context', 'component', 'sequence', 'failure-path'];
export const SYSTEM_DIAGRAMS = ['context', 'component', 'sequence', 'data-model', 'failure-path', 'deployment'];
export const FAILURE_FIELDS = ['Trigger', 'Symptoms', 'Blast radius', 'Detection', 'Mitigation', 'Recovery', 'Prevention'];
export const CHALLENGE_TYPES = ['concept', 'debugging', 'capacity', 'design', 'incident'];
export const QUESTION_LEVELS = ['foundational', 'senior', 'staff', 'principal'];
export const QUESTION_LABELS = ['Strong answer.', 'Why it is asked.', 'Weak-answer warning signs.', 'Follow-up.'];
export const MERMAID_TYPES = /^(flowchart|sequenceDiagram|stateDiagram-v2|classDiagram|erDiagram)\b/;
export const PLACEHOLDER_RE = /\bTODO\b|\bFIXME\b|\bTBD\b|\bXXX\b|lorem ipsum|coming soon|to be written/i;

export function checkContent(kind, r) {
  const errors = [];
  const req = kind === 'topic' ? TOPIC_SECTIONS : SYSTEM_SECTIONS;
  const h2 = r.ctx.headings.filter((h) => h.level === 2).map((h) => h.text);
  const names = req.map(([n]) => n);
  if (h2.join('|') !== names.join('|')) errors.push(`sections differ from contract: got [${h2.join(', ')}]`);
  for (const [name, subs] of req) {
    const start = r.ctx.headings.findIndex((h) => h.level === 2 && h.text === name);
    if (start < 0) continue;
    let end = r.ctx.headings.findIndex((h, i) => i > start && h.level === 2);
    if (end < 0) end = r.ctx.headings.length;
    const here = r.ctx.headings.slice(start, end).map((h) => h.text);
    for (const s of subs) if (!here.includes(s)) errors.push(`section "${name}" is missing subsection "${s}"`);
  }
  if (!/^lastReviewed: \d{4}-\d{2}-\d{2}/.test(r.raw)) errors.push('missing lastReviewed front matter');
  const need = kind === 'topic' ? TOPIC_DIAGRAMS : SYSTEM_DIAGRAMS;
  for (const d of need) if (!r.ctx.diagrams.some((x) => x.name === d)) errors.push(`missing diagram "${d}"`);
  for (const d of r.ctx.diagrams) {
    if (!d.title || !d.desc) errors.push(`diagram "${d.name}" needs a title and text alternative`);
    if (!MERMAID_TYPES.test(d.source.trim())) errors.push(`diagram "${d.name}" uses a type that is not permitted`);
    const after = r.raw.split(/^```$/m);
    const block = after.findIndex((chunk) => chunk.includes(`\`\`\`mermaid ${d.name} |`));
    if (block < 0 || !after[block + 1] || !/^\s*\n?[A-Z]/.test(after[block + 1].trimStart())) errors.push(`diagram "${d.name}" needs a written interpretation directly below it`);
  }
  if (kind === 'topic') {
    if (r.ctx.failures.length < 3) errors.push(`needs at least 3 failure modes, has ${r.ctx.failures.length}`);
    for (const f of r.ctx.failures) for (const k of FAILURE_FIELDS) if (!new RegExp(`^${k}:`, 'm').test(f.body)) errors.push(`failure "${f.name}" is missing ${k}`);
    for (const c of CHALLENGE_TYPES) {
      const ch = r.ctx.challenges.find((x) => x.type === c);
      if (!ch) errors.push(`missing ${c} challenge`);
      else for (const k of ['hint', 'solution', 'common mistakes']) if (!ch[k]) errors.push(`${c} challenge is missing ${k}`);
    }
    if (r.ctx.questions.length < 12) errors.push(`needs at least 12 interview questions, has ${r.ctx.questions.length}`);
    for (const l of QUESTION_LEVELS) if (!r.ctx.questions.some((q) => q.level === l)) errors.push(`no ${l} interview question`);
    for (const q of r.ctx.questions) for (const label of QUESTION_LABELS) if (!q.body.includes(`**${label}**`)) errors.push(`question "${q.question.slice(0, 40)}" is missing "${label}"`);
    if (r.ctx.quiz.length !== 5) errors.push(`needs exactly 5 quiz questions, has ${r.ctx.quiz.length}`);
    for (const q of r.ctx.quiz) if (q.correct < 0 || !q.explain) errors.push(`quiz "${q.question.slice(0, 40)}" needs a correct option and explanation`);
  }
  const hit = r.raw.match(PLACEHOLDER_RE);
  if (hit) errors.push(`placeholder text found: "${hit[0]}"`);
  return errors;
}
