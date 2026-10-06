import { writeFile, mkdir } from 'node:fs/promises';
import { concurrencyScenario } from '../tests/helpers/concurrency-scenario.mjs';
const result = await concurrencyScenario();
await mkdir(new URL('../docs/simulacion/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/simulacion/concurrencia-2026-10-06.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2));
console.log(JSON.stringify(result, null, 2));
