// Seeds the running API with the transactions in demo/sample-data.json.
// Usage:  node demo/seed.js  (server must already be running on localhost:3000)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST = process.env.API_HOST || 'http://localhost:3000';

async function seed() {
  const raw = await readFile(join(__dirname, 'sample-data.json'), 'utf-8');
  const data = JSON.parse(raw);

  let ok = 0;
  let failed = 0;

  for (const tx of data) {
    const res = await fetch(`${HOST}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    const body = await res.json();
    if (res.ok) {
      ok += 1;
      console.log(`  ✓ ${tx.type.padEnd(11)} ${body.id}`);
    } else {
      failed += 1;
      console.log(`  ✗ ${tx.type} — ${JSON.stringify(body)}`);
    }
  }

  console.log(`\nSeeded: ${ok} ok, ${failed} failed.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  console.error(`Is the server running at ${HOST}?  Start it with:  npm start`);
  process.exit(1);
});
