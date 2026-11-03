// A requirement is testable only if a reader can say what evidence would prove it false.
export type Kind = 'functional' | 'quality';

export interface Requirement {
  id: string;
  kind: Kind;
  text: string;
  metric?: string;
  target?: string;
  window?: string;
  loadCondition?: string;
}

export type Severity = 'error' | 'warning';

export interface Finding {
  requirementId: string;
  severity: Severity;
  rule: string;
  message: string;
}

const VAGUE_WORDS = /\b(fast|scalable|highly available|robust|reliable|secure|user[- ]friendly|real[- ]?time|seamless|efficient)\b/i;
const FIELDS = ['metric', 'target', 'window', 'loadCondition'] as const;

export function lintRequirement(r: Requirement): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string): void => {
    findings.push({ requirementId: r.id, severity, rule, message });
  };

  const vague = VAGUE_WORDS.exec(r.text);
  if (r.kind === 'quality') {
    for (const field of FIELDS) {
      if (!r[field]) add('error', `missing-${field}`, `A quality requirement needs ${field} to be falsifiable.`);
    }
    if (vague) add('warning', 'vague-word', `"${vague[0]}" has no meaning until the measure is stated.`);
  } else {
    if (vague) add('warning', 'hidden-quality', `"${vague[0]}" is a quality claim inside a functional requirement. Split it out.`);
    if (!/\b(can|must|shall|may)\b/i.test(r.text)) add('warning', 'no-modal', 'State who can do what, using an explicit modal verb.');
  }
  return findings;
}

export function parseRequirements(body: unknown): Requirement[] {
  if (!Array.isArray(body)) throw new ValidationError('Body must be a JSON array of requirements.');
  return body.map((item: unknown, index: number): Requirement => {
    if (typeof item !== 'object' || item === null) throw new ValidationError(`Item ${index} must be an object.`);
    const o = item as Record<string, unknown>;
    if (typeof o['id'] !== 'string' || o['id'] === '') throw new ValidationError(`Item ${index} needs a string id.`);
    if (o['kind'] !== 'functional' && o['kind'] !== 'quality') throw new ValidationError(`Item ${index} kind must be functional or quality.`);
    if (typeof o['text'] !== 'string' || o['text'] === '') throw new ValidationError(`Item ${index} needs text.`);
    const req: Requirement = { id: o['id'], kind: o['kind'], text: o['text'] };
    for (const field of FIELDS) {
      const value = o[field];
      if (typeof value === 'string') req[field] = value;
    }
    return req;
  });
}

export class ValidationError extends Error {}
