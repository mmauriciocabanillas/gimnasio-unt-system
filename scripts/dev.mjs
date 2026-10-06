import { createServer as httpServer } from 'node:http';
import { createServer as viteServer } from 'vite';
import { handleApi } from '../server/api.mjs';

const port = Number(process.env.PORT || 3180);
const vite = await viteServer({ server: { middlewareMode: true }, appType: 'spa' });
const server = httpServer((req, res) => req.url.startsWith('/api/') ? handleApi(req, res) : vite.middlewares(req, res));
server.listen(port, '127.0.0.1', () => console.log(`Gimnasio UNT: http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await vite.close(); server.close(); });
