/* QA aislado: worker_threads independientes y mutex Atomics. Google sigue simulado. */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { googleHarness } from './google-harness.mjs';
import { handleApi } from '../../server/api.mjs';

function storeFor(buffers) {
  const control = new Int32Array(buffers.control), bytes = new Uint8Array(buffers.data);
  return {
    control,
    read() { return JSON.parse(Buffer.from(bytes.subarray(0, Atomics.load(control, 1))).toString('utf8')); },
    write(value) {
      const encoded = Buffer.from(JSON.stringify(value));
      if (encoded.length > bytes.length) throw new Error('Snapshot QA supera el buffer reservado.');
      bytes.set(encoded); Atomics.store(control, 1, encoded.length);
    },
    acquire(timeout) {
      const deadline = performance.now() + timeout; let contended = false;
      while (Atomics.compareExchange(control, 0, 0, 1) !== 0) {
        if (!contended) { Atomics.add(control, 4, 1); contended = true; }
        const left = deadline - performance.now(); if (left <= 0) return false;
        Atomics.wait(control, 0, 1, left);
      }
      Atomics.add(control, 5, 1);
      const inside = Atomics.add(control, 7, 1) + 1;
      Atomics.store(control, 6, Math.max(inside, Atomics.load(control, 6)));
      // Latencia de servicio ficticia para que contendientes alcancen el mutex.
      Atomics.wait(control, 11, 0, 5);
      return true;
    },
    release() { Atomics.sub(control, 7, 1); Atomics.store(control, 0, 0); Atomics.notify(control, 0); }
  };
}

export async function parallelGoogle(seed, jobs, now) {
  const buffers = { control: new SharedArrayBuffer(12 * 4), data: new SharedArrayBuffer(8 * 1024 * 1024) };
  const shared = storeFor(buffers); shared.write(seed);
  const workers = [], pending = [], ready = [];
  for (let i = 0; i < jobs.length; i++) {
    const worker = new Worker(new URL(import.meta.url), { workerData: { buffers, job: jobs[i], now, i } });
    workers.push(worker);
    let resolveReady, rejectReady;
    ready.push(new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; }));
    pending.push(new Promise((resolve, reject) => {
      worker.on('message', value => { if (value.ready) resolveReady(); else if (value.error) reject(new Error(value.error)); else resolve(value); });
      worker.on('error', error => { rejectReady(error); reject(error); });
      worker.on('exit', code => { if (code) { const error = new Error('Worker QA terminó con código ' + code); rejectReady(error); reject(error); } });
    }));
  }
  const deadline = setTimeout(() => workers.forEach(w => w.terminate()), 55000);
  try {
    await Promise.all(ready);
    const started = performance.now();
    Atomics.store(shared.control, 3, 1); Atomics.notify(shared.control, 3, jobs.length);
    const results = await Promise.all(pending);
    return { snapshot: shared.read(), results, ms: Math.round(performance.now() - started),
      workers: jobs.length, simultaneousStart: true, lockWaits: Atomics.load(shared.control, 4),
      acquisitions: Atomics.load(shared.control, 5), maxCriticalSections: Atomics.load(shared.control, 6),
      maxRequestsInFlight: Atomics.load(shared.control, 9) };
  } finally { clearTimeout(deadline); await Promise.all(workers.map(w => w.terminate())); }
}

if (!isMainThread) {
  const { buffers, job, now, i } = workerData, shared = storeFor(buffers);
  const h = googleHarness(now, undefined, { shared });
  parentPort.postMessage({ ready: true });
  Atomics.wait(shared.control, 3, 0);
  const active = Atomics.add(shared.control, 8, 1) + 1;
  let seen = Atomics.load(shared.control, 9);
  while (active > seen) { const old = Atomics.compareExchange(shared.control, 9, seen, active); if (old === seen) break; seen = old; }
  const started = performance.now();
  try {
    let result;
    if (job.task === 'rollover') result = { status: 200, body: h.context.procesarCambioMensual() || null };
    else {
      const req = { url: '/api/' + job.action, method: 'POST', body: job.data,
        socket: { remoteAddress: job.clientIp || 'qa-client-' + i }, headers: { host: 'qa.local', origin: 'http://qa.local' } };
      const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
      await handleApi(req, res, { env: h.env, invoke: async (action, data) => h.invoke(action, data) });
      result = { status: res.statusCode, body: res.body };
    }
    parentPort.postMessage({ ...result, ms: Math.round(performance.now() - started), client: i });
  } catch (e) { parentPort.postMessage({ status: e.status || 500, body: { error: e.message }, ms: Math.round(performance.now() - started), client: i }); }
  finally { Atomics.sub(shared.control, 8, 1); parentPort.close(); }
}
