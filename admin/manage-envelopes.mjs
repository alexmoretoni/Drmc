#!/usr/bin/env node
// Utilitário CLI administrativo do Projeto Atenção
// Uso:
//   POLAR_BASE_URL=http://localhost:3000 POLAR_ADMIN_TOKEN=... node admin/manage-envelopes.mjs list
//   POLAR_BASE_URL=http://localhost:3000 POLAR_ADMIN_TOKEN=... node admin/manage-envelopes.mjs get <invite> <file>
//   POLAR_BASE_URL=http://localhost:3000 POLAR_ADMIN_TOKEN=... node admin/manage-envelopes.mjs delete <invite> <file>

const base = (process.env.POLAR_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const token = process.env.POLAR_ADMIN_TOKEN || '';
const [cmd, invite, file] = process.argv.slice(2);

if (!token) {
  console.error('Defina a variável de ambiente POLAR_ADMIN_TOKEN.');
  process.exit(1);
}

const headers = { 'X-Polar-Token': token };

async function main() {
  if (cmd === 'list') {
    const res = await fetch(`${base}/api/envelope?action=list`, { headers });
    console.log(await res.text());
    return;
  }
  if (cmd === 'get' && invite && file) {
    const url = `${base}/api/envelope?action=get&invite=${encodeURIComponent(invite)}&file=${encodeURIComponent(file)}`;
    const res = await fetch(url, { headers });
    console.log(await res.text());
    return;
  }
  if (cmd === 'delete' && invite && file) {
    const url = `${base}/api/envelope?action=delete&invite=${encodeURIComponent(invite)}&file=${encodeURIComponent(file)}`;
    const res = await fetch(url, { method: 'POST', headers });
    console.log(await res.text());
    return;
  }
  console.log('Comandos: list | get <invite> <file> | delete <invite> <file>');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
