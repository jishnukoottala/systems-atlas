#!/usr/bin/env node
// Builds curriculum-manifest.json and generation-state.json from the catalog.
// Safe to re-run: IDs are derived from the catalog and existing statuses are preserved.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildTopics, stableId, SYSTEMS, PATTERNS, DOMAINS } from './lib/catalog.mjs';

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const prior = read('curriculum-manifest.json');
const priorStatus = new Map();
if (prior) for (const e of [...prior.topics, ...prior.systems]) priorStatus.set(e.id, e.status);

const topics = buildTopics();
const relatedSets = new Map(topics.map((t) => [t.short, new Set(t.relatedShort)]));
for (const t of topics) for (const r of t.relatedShort) relatedSets.get(r).add(t.short);
const keywordsOf = (t) => [...new Set(`${t.title} ${t.domainName}`.toLowerCase().replace(/[^a-z0-9/ -]+/g, ' ').split(/\s+/).filter((w) => w.length > 2))];

const manifest = {
  title: 'Systems Atlas',
  tagline: 'Master system design from first principles to production',
  schemaVersion: 1,
  storageNamespace: 'principal-system-design-curriculum:v1',
  domains: DOMAINS,
  topics: topics.map((t, order) => ({
    id: t.id,
    order,
    originalTopicNumber: t.short[0] === 'o' ? Number(t.short.slice(1)) : null,
    additionalTopicNumber: t.short[0] === 'a' ? Number(t.short.slice(1)) : null,
    title: t.title,
    slug: t.slug,
    domain: t.domain,
    domainName: t.domainName,
    level: t.level,
    prerequisites: t.prereqShort.map(stableId),
    studyMinutes: t.minutes,
    relatedTopics: [...relatedSets.get(t.short)].filter((r) => r !== t.short).map(stableId),
    requiredLanguages: t.languages,
    status: priorStatus.get(t.id) ?? 'pending',
    pagePath: `topics/${t.slug}/index.html`,
    keywords: keywordsOf(t),
  })),
  systems: SYSTEMS.map(([slug, title], i) => {
    const id = `S${String(i + 1).padStart(2, '0')}`;
    return {
      id, order: i, title, slug, domain: 'S', domainName: 'Systems dissected', level: 'Principal',
      prerequisites: [], studyMinutes: 240, relatedTopics: [], requiredLanguages: ['typescript', 'python'],
      status: priorStatus.get(id) ?? 'pending', pagePath: `systems-dissect/${slug}/index.html`,
      keywords: title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2),
    };
  }),
  patterns: { status: prior?.patterns?.status ?? 'pending', pagePath: 'systems-dissect/patterns/index.html', items: PATTERNS },
};
writeFileSync('curriculum-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

if (!read('generation-state.json')) {
  writeFileSync('generation-state.json', `${JSON.stringify({
    schemaVersion: 1, phase: 2, batchSize: 5, updatedAt: new Date().toISOString(),
    nextItems: manifest.topics.slice(0, 5).map((t) => t.id),
    items: {}, claimsRequiringVerification: [], notes: [],
  }, null, 2)}\n`);
}
console.log(`manifest: ${manifest.topics.length} topics, ${manifest.systems.length} systems`);
