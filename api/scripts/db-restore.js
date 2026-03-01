/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const { resolve, basename } = require('node:path');
const { existsSync } = require('node:fs');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} falhou`);
  }
}

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('Uso: npm run db:restore -- ./backups/arquivo.dump');
  process.exit(1);
}

const inputFile = resolve(inputArg);
if (!existsSync(inputFile)) {
  console.error(`Arquivo não encontrado: ${inputFile}`);
  process.exit(1);
}

const container = process.env.DB_DOCKER_CONTAINER || 'lexflow_db';
const dbUser = process.env.DB_BACKUP_USER || 'lexflow';
const dbName = process.env.DB_BACKUP_NAME || 'lexflow';
const remoteFile = `/tmp/${basename(inputFile)}`;

console.log(`[restore] copiando dump para container ${container}...`);
run('docker', ['cp', inputFile, `${container}:${remoteFile}`]);

console.log('[restore] restaurando base de dados...');
run('docker', [
  'exec',
  container,
  'sh',
  '-lc',
  `pg_restore -U ${dbUser} -d ${dbName} --clean --if-exists ${remoteFile}`,
]);

console.log('[restore] limpando arquivo temporário no container...');
run('docker', ['exec', container, 'rm', '-f', remoteFile]);

console.log('[restore] concluído.');
