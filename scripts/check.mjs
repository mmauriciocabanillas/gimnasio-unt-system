import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

let failed = false;
for (const folder of ['server', 'scripts', 'api', 'src']) {
  for (const file of await readdir(folder)) {
    if (!/\.(mjs|js)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', `${folder}/${file}`], { encoding: 'utf8' });
    if (result.status !== 0) { console.error(result.stderr); failed = true; }
  }
}
for (const file of ['Domain.js', 'Code.js']) {
  try { new vm.Script(await readFile(`apps-script/${file}`, 'utf8'), { filename: file }); } catch (error) { console.error(error); failed = true; }
}
for (const file of ['vercel.json', 'apps-script/appsscript.json', 'package.json']) JSON.parse(await readFile(file, 'utf8'));
console.log(failed ? 'Hay errores de sintaxis.' : 'Sintaxis JavaScript y JSON correcta.');
process.exitCode = failed ? 1 : 0;
