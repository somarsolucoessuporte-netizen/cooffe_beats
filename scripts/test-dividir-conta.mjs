// Isolated runner: no Next CLI, dotenv, Prisma client or external payment SDK.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.test-dividir-conta');
if (path.dirname(output) !== root || path.basename(output) !== '.test-dividir-conta') throw new Error('Invalid test directory');
const files = ['lib/mercadopago.ts', 'lib/dividir-conta/domain.ts', 'lib/dividir-conta/service.ts', 'lib/dividir-conta/legacy.ts', 'lib/dividir-conta/mercadopago.ts', 'tests/dividir-conta/route-harness.ts', 'tests/dividir-conta/financial.test.ts'];
for (const file of files) {
  const target = path.join(output, file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const result = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: file,
  });
  fs.writeFileSync(target, result.outputText);
}
const env = {};
for (const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','windir','TEMP','TMP','ComSpec','PATHEXT']) if (process.env[key]) env[key] = process.env[key];
const result = spawnSync(process.execPath, ['--test', path.join(output, 'tests/dividir-conta/financial.test.js')], { cwd: root, stdio: 'inherit', env });
process.exitCode = result.status ?? 1;
