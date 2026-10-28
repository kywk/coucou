// Run with Node 22.18+:
//   node scripts/benchmark-diff.mjs [path/to/baseline-diff.ts]
// Optional baseline must expose fromEdit, like windows/src/core/diff.ts.
// Timings cover the whole diff operation, not just the LCS table. They do not
// measure application RSS or webview rendering. No timing assertions in CI.
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fromEdit } from '../windows/src/core/diff.ts';

const engines = [['current', fromEdit]];
if (process.argv[2]) {
  const baseline = await import(pathToFileURL(resolve(process.argv[2])).href);
  engines.unshift(['baseline', baseline.fromEdit]);
}
let checksum = 0;
const results = [];
for (const [scenario, index] of [['unchanged', -1], ['first line', 0], ['middle line', 500], ['last line', 999]]) {
  const lines = Array.from({ length: 1000 }, (_, i) => `line${i}`);
  const oldText = lines.join('\n');
  if (index >= 0) lines[index] = 'changed';
  const newText = lines.join('\n');
  for (const [engine, diff] of engines) {
    for (let i = 0; i < 10; i++) diff(oldText, newText, '/benchmark');
    const samples = [];
    for (let sample = 0; sample < 5; sample++) {
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        const result = diff(oldText, newText, '/benchmark');
        checksum += result.added + result.removed + result.hunks.length;
      }
      samples.push((performance.now() - start) / 50);
    }
    samples.sort((a, b) => a - b);
    results.push({ scenario, engine, 'median ms/op': samples[2].toFixed(3) });
  }
}
console.table(results);
console.log('checksum:', checksum);
