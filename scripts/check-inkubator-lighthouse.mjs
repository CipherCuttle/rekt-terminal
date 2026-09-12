import fs from 'node:fs';

const reports = process.argv.slice(2);
if (!reports.length) throw new Error('Pass one or more Lighthouse JSON report paths.');

const loaded = reports.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const category = (name) => median(loaded.map((report) => report.categories[name]?.score ?? 0));
const audit = (name) => median(loaded.map((report) => report.audits[name]?.numericValue ?? Number.POSITIVE_INFINITY));

const scores = {
  performance: category('performance'),
  accessibility: category('accessibility'),
  bestPractices: category('best-practices'),
  seo: category('seo'),
  lcp: audit('largest-contentful-paint'),
  cls: audit('cumulative-layout-shift'),
  tbt: audit('total-blocking-time'),
};

const pct = (value) => Math.round(value * 100);
console.log(`Lighthouse median (${loaded.length} run${loaded.length === 1 ? '' : 's'})`);
console.log(`- Performance: ${pct(scores.performance)}`);
console.log(`- Accessibility: ${pct(scores.accessibility)}`);
console.log(`- Best Practices: ${pct(scores.bestPractices)}`);
console.log(`- SEO: ${pct(scores.seo)}`);
console.log(`- LCP: ${Math.round(scores.lcp)} ms`);
console.log(`- CLS: ${scores.cls.toFixed(3)}`);
console.log(`- TBT: ${Math.round(scores.tbt)} ms`);

function failedAudits(categoryId) {
  const refs = loaded[0]?.categories?.[categoryId]?.auditRefs ?? [];
  return refs
    .filter((ref) => (ref.weight ?? 0) > 0)
    .map((ref) => {
      const audits = loaded.map((report) => report.audits?.[ref.id]).filter(Boolean);
      const score = median(audits.map((item) => typeof item.score === 'number' ? item.score : 1));
      const representative = audits[Math.floor(audits.length / 2)] ?? audits[0];
      return {
        id: ref.id,
        score,
        title: representative?.title ?? ref.id,
        displayValue: representative?.displayValue ?? '',
      };
    })
    .filter((item) => item.score < 1)
    .sort((a, b) => a.score - b.score);
}

for (const categoryId of ['accessibility', 'best-practices', 'seo']) {
  const bad = failedAudits(categoryId);
  if (!bad.length) continue;
  console.log(`\nFailed ${categoryId} audits:`);
  bad.forEach((item) => console.log(`- ${item.id}: ${Math.round(item.score * 100)} — ${item.title}${item.displayValue ? ` (${item.displayValue})` : ''}`));
}

const perfWatch = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'speed-index',
  'total-blocking-time',
  'cumulative-layout-shift',
  'interactive',
  'render-blocking-resources',
  'unused-javascript',
  'unused-css-rules',
  'image-delivery-insight',
  'network-dependency-tree-insight',
];
console.log('\nPerformance audit watch:');
for (const id of perfWatch) {
  const audits = loaded.map((report) => report.audits?.[id]).filter(Boolean);
  if (!audits.length) continue;
  const score = median(audits.map((item) => typeof item.score === 'number' ? item.score : 1));
  const numeric = median(audits.map((item) => typeof item.numericValue === 'number' ? item.numericValue : 0));
  const representative = audits[Math.floor(audits.length / 2)] ?? audits[0];
  console.log(`- ${id}: score ${Math.round(score * 100)}${numeric ? ` / ${Math.round(numeric)}ms` : ''}${representative?.displayValue ? ` / ${representative.displayValue}` : ''}`);
}

const failures = [];
if (scores.performance < 0.90) failures.push(`Performance ${pct(scores.performance)} < 90`);
if (scores.accessibility < 0.98) failures.push(`Accessibility ${pct(scores.accessibility)} < 98`);
if (scores.bestPractices < 0.95) failures.push(`Best Practices ${pct(scores.bestPractices)} < 95`);
if (scores.seo < 0.98) failures.push(`SEO ${pct(scores.seo)} < 98`);
if (scores.lcp > 3000) failures.push(`LCP ${Math.round(scores.lcp)}ms > 3000ms`);
if (scores.cls > 0.10) failures.push(`CLS ${scores.cls.toFixed(3)} > 0.10`);
if (scores.tbt > 250) failures.push(`TBT ${Math.round(scores.tbt)}ms > 250ms`);

if (failures.length) {
  console.error('\nLighthouse gate failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Lighthouse gate: PASS');
