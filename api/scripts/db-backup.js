/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { resolve, basename, dirname } = require('node:path');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} falhou`);
  }
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const container = process.env.DB_DOCKER_CONTAINER || 'lexflow_db';
const dbUser = process.env.DB_BACKUP_USER || 'lexflow';
const dbName = process.env.DB_BACKUP_NAME || 'lexflow';

const outputArg = process.argv[2];
const outputFile = resolve(
  outputArg || `backups/lexflow_backup_${nowStamp()}.dump`,
);
const remoteFile = `/tmp/${basename(outputFile)}`;

mkdirSync(dirname(outputFile), { recursive: true });

console.log(`[backup] criando dump no container ${container}...`);
run('docker', [
  'exec',
  container,
  'sh',
  '-lc',
  `pg_dump -U ${dbUser} -d ${dbName} -Fc -f ${remoteFile}`,
]);

console.log(`[backup] copiando dump para ${outputFile}...`);
run('docker', ['cp', `${container}:${remoteFile}`, outputFile]);

console.log('[backup] limpando arquivo temporário no container...');
run('docker', ['exec', container, 'rm', '-f', remoteFile]);

console.log(`[backup] concluído: ${outputFile}`);
