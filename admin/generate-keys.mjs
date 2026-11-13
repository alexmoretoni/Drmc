#!/usr/bin/env node
import crypto from 'node:crypto';

const inviteKey = crypto.randomBytes(32).toString('hex');
const adminToken = crypto.randomBytes(24).toString('hex');
const adminTokenSha256 = crypto.createHash('sha256').update(adminToken).digest('hex');

console.log('# Adicione ao seu arquivo .env (mantenha em sigilo):');
console.log(`INVITE_KEY="${inviteKey}"`);
console.log(`ADMIN_TOKEN_SHA256="${adminTokenSha256}"`);
console.log('');
console.log('# Token administrativo para usar no cabeçalho X-Polar-Token ou no CLI:');
console.log(`POLAR_ADMIN_TOKEN="${adminToken}"`);
