// Validate Prisma syntax from an isolated temporary project. Does not load .env
// from the application and does not run migrations/generate/connect to a database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'coffeebeats-schema-'));
fs.writeFileSync(path.join(temp,'package.json'),'{"private":true}');
fs.copyFileSync(path.join(root,'prisma/schema.prisma'),path.join(temp,'schema.prisma'));
const env={};
for(const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','windir','TEMP','TMP','ComSpec','PATHEXT']) if(process.env[key]) env[key]=process.env[key];
env.DATABASE_URL='postgresql://local:local@127.0.0.1:1/disposable';
env.DIRECT_URL=env.DATABASE_URL;
env.PRISMA_HIDE_UPDATE_MESSAGE='1';
const result=spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'validate','--schema',path.join(temp,'schema.prisma')],{cwd:temp,env,stdio:'inherit'});
process.exitCode=result.status ?? 1;
