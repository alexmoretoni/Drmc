import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import JSZip from 'jszip';

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_CONFIG_FILE = path.resolve('./data/admin-config.json');
const DEV_KEYS_FILE = path.resolve('./data/.dev-keys.json');

const DEFAULT_PUBLIC_JWK = {
  kty: 'RSA',
  alg: 'RSA-OAEP-256',
  ext: true,
  key_ops: ['encrypt'],
  n: 'rSbunbMu6G1KRzFas_begh2g-7KUF_6YX69hZgsVQ_7FBbXDGFFgqEEJP44DDT2B76jbNrUwW63bkXaoURkUrSsexwM2SolMBuxzkd8vXa3NuDwlAgEj7BAQRZQdFlVXH6zuGi5F5sPJcin8XlTj3qFqf8D-MochFkDJRpZFGbvu3jGXRwiHPjWIl_cx7cZMxrErFvNcKPuB20tiB5uzE842iaIXkE8R-KVb8kHpc8jtESMGcQASJrrW6NYzwO4rtpYbNZ7pWR4tiG97Sg1asLLi0DCFL1aLWRdfBtrc9X_HCgDFXNnWgcGdyWDeINabomcyqeFRfA2X8ch-H8La-MUdGcOhzhasufb9GY7nidouSK5_MV2XbncEpBR5HYIVS6q9lnNmKpsML_PXm74QnmaXQG5jRxIOqlcZ2SEtNZzbjAu0n1OYeoJjoWQwd0FH6hqen2klWILZZqV0EqMzv2KDQa-vK-qAxckuymfVGpOOmTjVlr12KS9RODTE1XFR',
  e: 'AQAB',
};

interface RuntimeSettings {
  inviteKeyHex: string;
  adminTokenSha256: string;
  hasCustomAdminToken: boolean;
  devAdminToken: string | null;
  dataDir: string;
  maxBytes: number;
  maxFiles: number;
  publicJwk: Record<string, unknown>;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function loadSettings(): RuntimeSettings {
  const envInvite = (process.env.INVITE_KEY || '').trim();
  const envAdminHash = (process.env.ADMIN_TOKEN_SHA256 || '').trim();
  const envDataDir = (process.env.ENVELOPE_DATA_DIR || '').trim();
  const envMaxBytes = Number(process.env.MAX_BYTES || 0);
  const envMaxFiles = Number(process.env.MAX_FILES || 0);
  let envJwk: Record<string, unknown> | null = null;
  if (process.env.POLAR_PUBLIC_JWK) {
    try {
      envJwk = JSON.parse(process.env.POLAR_PUBLIC_JWK);
    } catch {
      envJwk = null;
    }
  }

  let savedAdmin: Partial<RuntimeSettings> = {};
  if (fs.existsSync(ADMIN_CONFIG_FILE)) {
    try {
      savedAdmin = JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
    } catch {
      savedAdmin = {};
    }
  }

  let devKeys: { inviteKeyHex?: string; adminTokenSha256?: string; devAdminToken?: string } = {};
  if (fs.existsSync(DEV_KEYS_FILE)) {
    try {
      devKeys = JSON.parse(fs.readFileSync(DEV_KEYS_FILE, 'utf8'));
    } catch {
      devKeys = {};
    }
  }

  const hasSavedAdminHash =
    typeof savedAdmin.adminTokenSha256 === 'string' && /^[a-f0-9]{64}$/.test(savedAdmin.adminTokenSha256);
  const hasEnvAdminHash = /^[a-f0-9]{64}$/.test(envAdminHash);

  if (!hasSavedAdminHash && !hasEnvAdminHash && (!devKeys.devAdminToken || !devKeys.inviteKeyHex)) {
    ensureDir(path.dirname(DEV_KEYS_FILE));
    const token = crypto.randomBytes(24).toString('hex');
    devKeys = {
      inviteKeyHex: crypto.randomBytes(32).toString('hex'),
      devAdminToken: token,
      adminTokenSha256: crypto.createHash('sha256').update(token).digest('hex'),
    };
    fs.writeFileSync(DEV_KEYS_FILE, JSON.stringify(devKeys, null, 2), { mode: 0o600 });
  }

  const inviteKeyHex =
    (typeof savedAdmin.inviteKeyHex === 'string' && /^[a-f0-9]{64}$/.test(savedAdmin.inviteKeyHex)
      ? savedAdmin.inviteKeyHex
      : '') ||
    envInvite ||
    devKeys.inviteKeyHex ||
    crypto.randomBytes(32).toString('hex');

  const adminTokenSha256 =
    (hasSavedAdminHash ? savedAdmin.adminTokenSha256! : '') ||
    envAdminHash ||
    devKeys.adminTokenSha256!;

  const hasCustomAdminToken = hasSavedAdminHash || hasEnvAdminHash;
  const devAdminToken = hasCustomAdminToken ? null : devKeys.devAdminToken || null;

  const dataDir = path.resolve(
    (typeof savedAdmin.dataDir === 'string' && savedAdmin.dataDir.trim()) ||
      envDataDir ||
      './data/envelopes'
  );

  const maxBytes =
    (typeof savedAdmin.maxBytes === 'number' && savedAdmin.maxBytes >= 65536 ? savedAdmin.maxBytes : 0) ||
    (envMaxBytes >= 65536 ? envMaxBytes : 0) ||
    3 * 1024 * 1024;

  const maxFiles =
    (typeof savedAdmin.maxFiles === 'number' && savedAdmin.maxFiles >= 1 ? savedAdmin.maxFiles : 0) ||
    (envMaxFiles >= 1 ? envMaxFiles : 0) ||
    600;

  const publicJwk =
    (savedAdmin.publicJwk && typeof savedAdmin.publicJwk === 'object' ? savedAdmin.publicJwk : null) ||
    envJwk ||
    DEFAULT_PUBLIC_JWK;

  return {
    inviteKeyHex,
    adminTokenSha256,
    hasCustomAdminToken,
    devAdminToken,
    dataDir,
    maxBytes,
    maxFiles,
    publicJwk,
  };
}

let SETTINGS = loadSettings();

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text: string): Buffer | null {
  try {
    const norm = text.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (norm.length % 4)) % 4;
    return Buffer.from(norm + '='.repeat(pad), 'base64');
  } catch {
    return null;
  }
}

function verifyInviteId(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = b64url(
    crypto.createHmac('sha256', Buffer.from(SETTINGS.inviteKeyHex, 'hex')).update(payload).digest()
  ).slice(0, 32);

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  const decoded = b64urlDecode(payload);
  if (!decoded) return null;
  try {
    const data = JSON.parse(decoded.toString('utf8'));
    if (!data || typeof data.i !== 'string' || !/^[a-f0-9]{16}$/.test(data.i)) {
      return null;
    }
    if (data.e !== undefined && Math.floor(Date.now() / 1000) > Number(data.e)) {
      return null;
    }
    return data.i;
  } catch {
    return null;
  }
}

function isAdmin(req: express.Request): boolean {
  const token = req.header('x-polar-token') || '';
  if (!token) return false;
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  const a = Buffer.from(SETTINGS.adminTokenSha256);
  const b = Buffer.from(digest);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validName(invite: string, file: string): boolean {
  return /^[a-f0-9]{16}$/.test(invite) && /^(stage|partial)-[A-Za-z0-9_-]{1,64}\.json$/.test(file);
}

async function ensureCompiledBuild(rootDir: string): Promise<void> {
  const distIndex = path.join(rootDir, 'dist', 'index.html');
  const serverJs = path.join(rootDir, 'server.js');
  if (!fs.existsSync(distIndex)) {
    const { build } = await import('vite');
    await build({ root: rootDir });
  }
  if (!fs.existsSync(serverJs)) {
    const esbuild = await import('esbuild');
    await esbuild.build({
      entryPoints: [path.join(rootDir, 'server.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
      outfile: serverJs,
    });
  }
}

async function startServer() {
  ensureDir(SETTINGS.dataDir);
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      api: '/api/envelope',
      jwk: SETTINGS.publicJwk,
      devToolsAvailable: SETTINGS.devAdminToken !== null,
      devAdminToken: SETTINGS.devAdminToken,
    });
  });

  app.get('/api/admin/settings', (req, res) => {
    if (!isAdmin(req)) {
      res.status(403).json({ erro: 'acesso negado' });
      return;
    }
    res.json({
      inviteKeyHex: SETTINGS.inviteKeyHex,
      hasCustomAdminToken: SETTINGS.hasCustomAdminToken,
      dataDir: SETTINGS.dataDir,
      maxBytes: SETTINGS.maxBytes,
      maxFiles: SETTINGS.maxFiles,
      publicJwk: SETTINGS.publicJwk,
    });
  });

  app.post('/api/admin/settings', express.json({ limit: '64kb' }), (req, res) => {
    if (!isAdmin(req)) {
      res.status(403).json({ erro: 'acesso negado' });
      return;
    }
    const body = req.body || {};

    const nextInviteKey =
      typeof body.inviteKeyHex === 'string' && body.inviteKeyHex.trim()
        ? body.inviteKeyHex.trim().toLowerCase()
        : SETTINGS.inviteKeyHex;
    if (!/^[a-f0-9]{64}$/.test(nextInviteKey)) {
      res.status(400).json({ erro: 'INVITE_KEY deve conter exatamente 64 caracteres hexadecimais (32 bytes).' });
      return;
    }

    let nextAdminHash = SETTINGS.adminTokenSha256;
    let nextHasCustom = SETTINGS.hasCustomAdminToken;
    if (typeof body.newAdminToken === 'string' && body.newAdminToken.trim()) {
      const trimmedToken = body.newAdminToken.trim();
      if (trimmedToken.length < 8) {
        res.status(400).json({ erro: 'O novo token administrativo deve ter ao menos 8 caracteres.' });
        return;
      }
      nextAdminHash = crypto.createHash('sha256').update(trimmedToken).digest('hex');
      nextHasCustom = true;
    }

    const nextDataDir =
      typeof body.dataDir === 'string' && body.dataDir.trim()
        ? path.resolve(body.dataDir.trim())
        : SETTINGS.dataDir;

    const nextMaxBytes =
      body.maxBytes !== undefined ? Math.round(Number(body.maxBytes)) : SETTINGS.maxBytes;
    if (!Number.isFinite(nextMaxBytes) || nextMaxBytes < 65536 || nextMaxBytes > 50 * 1024 * 1024) {
      res.status(400).json({ erro: 'MAX_BYTES deve estar entre 65536 bytes e 50 MB.' });
      return;
    }

    const nextMaxFiles =
      body.maxFiles !== undefined ? Math.round(Number(body.maxFiles)) : SETTINGS.maxFiles;
    if (!Number.isFinite(nextMaxFiles) || nextMaxFiles < 1 || nextMaxFiles > 10000) {
      res.status(400).json({ erro: 'MAX_FILES deve estar entre 1 e 10000.' });
      return;
    }

    let nextJwk = SETTINGS.publicJwk;
    if (body.publicJwk !== undefined) {
      const parsed =
        typeof body.publicJwk === 'string' ? JSON.parse(body.publicJwk) : body.publicJwk;
      if (!parsed || typeof parsed !== 'object' || parsed.kty !== 'RSA' || !parsed.n || !parsed.e) {
        res.status(400).json({ erro: 'POLAR_PUBLIC_JWK inválida: informe uma chave pública RSA-OAEP-256 em JSON.' });
        return;
      }
      nextJwk = parsed;
    }

    ensureDir(path.dirname(ADMIN_CONFIG_FILE));
    ensureDir(nextDataDir);
    const persisted = {
      inviteKeyHex: nextInviteKey,
      adminTokenSha256: nextAdminHash,
      dataDir: nextDataDir,
      maxBytes: nextMaxBytes,
      maxFiles: nextMaxFiles,
      publicJwk: nextJwk,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(persisted, null, 2), { mode: 0o600 });

    SETTINGS = {
      inviteKeyHex: nextInviteKey,
      adminTokenSha256: nextAdminHash,
      hasCustomAdminToken: nextHasCustom,
      devAdminToken: nextHasCustom ? null : SETTINGS.devAdminToken,
      dataDir: nextDataDir,
      maxBytes: nextMaxBytes,
      maxFiles: nextMaxFiles,
      publicJwk: nextJwk,
    };

    res.json({
      ok: true,
      inviteKeyHex: SETTINGS.inviteKeyHex,
      hasCustomAdminToken: SETTINGS.hasCustomAdminToken,
      dataDir: SETTINGS.dataDir,
      maxBytes: SETTINGS.maxBytes,
      maxFiles: SETTINGS.maxFiles,
      publicJwk: SETTINGS.publicJwk,
    });
  });

  app.post('/api/dev/invite', express.json({ limit: '32kb' }), (req, res) => {
    if (SETTINGS.hasCustomAdminToken && !isAdmin(req)) {
      res.status(403).json({ erro: 'acesso negado' });
      return;
    }
    const body = req.body || {};
    const id =
      typeof body.id === 'string' && /^[a-f0-9]{16}$/.test(body.id)
        ? body.id
        : crypto.randomBytes(8).toString('hex');
    const form = body.form === 'B' ? 'B' : 'A';
    const fields = Array.isArray(body.fields)
      ? body.fields.filter((f: unknown) => typeof f === 'string')
      : ['idade', 'escolaridade', 'sono'];
    const expHours = Number(body.expHours) || 168;
    const payloadObj = {
      i: id,
      f: form,
      a: fields,
      e: Math.floor(Date.now() / 1000) + expHours * 3600,
    };
    const payload = b64url(Buffer.from(JSON.stringify(payloadObj), 'utf8'));
    const sig = b64url(
      crypto.createHmac('sha256', Buffer.from(SETTINGS.inviteKeyHex, 'hex')).update(payload).digest()
    ).slice(0, 32);
    const token = `${payload}.${sig}`;
    res.json({ token, inviteId: id, form, fields });
  });

  app.all('/api/envelope', (req, res) => {
    express.text({ type: '*/*', limit: SETTINGS.maxBytes + 1024 })(req, res, () => {
      res.setHeader('Cache-Control', 'no-store');
      const action = String(req.query.action || '');

      if (action === 'upload') {
        if (req.method !== 'POST') {
          res.status(405).json({ erro: 'use POST' });
          return;
        }
        const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');
        if (Buffer.byteLength(raw, 'utf8') > SETTINGS.maxBytes) {
          res.status(413).json({ erro: 'envio grande demais' });
          return;
        }
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw);
        } catch {
          res.status(400).json({ erro: 'conteúdo inválido' });
          return;
        }
        const id = verifyInviteId(String(body.invite || ''));
        if (!id) {
          res.status(403).json({ erro: 'link inválido ou vencido' });
          return;
        }
        const kind = String(body.kind || '');
        const submission = String(body.submission || '');
        if ((kind !== 'stage' && kind !== 'partial') || !/^[A-Za-z0-9_-]{1,64}$/.test(submission)) {
          res.status(400).json({ erro: 'identificação inválida' });
          return;
        }
        for (const field of ['key', 'iv', 'data']) {
          if (typeof body[field] !== 'string') {
            res.status(400).json({ erro: 'envelope incompleto' });
            return;
          }
        }
        const rows = Number(body.n || 0);
        const dir = path.join(SETTINGS.dataDir, id);
        ensureDir(dir);
        const file = path.join(dir, `${kind}-${submission}.json`);

        if (!fs.existsSync(file)) {
          const existing = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
          if (existing.length >= SETTINGS.maxFiles) {
            res.status(429).json({ erro: 'limite de envios deste link' });
            return;
          }
        }

        if (kind === 'partial' && fs.existsSync(file)) {
          try {
            const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (Number(prev.n || 0) > rows) {
              res.json({ ok: true });
              return;
            }
          } catch {
            // sobrescreve se inválido
          }
        }

        const record = JSON.stringify({
          v: 1,
          kind,
          submission,
          n: rows,
          key: body.key,
          iv: body.iv,
          data: body.data,
          recebido: new Date().toISOString(),
        });
        const tmp = `${file}.tmp${crypto.randomBytes(4).toString('hex')}`;
        fs.writeFileSync(tmp, record, { mode: 0o600 });
        fs.renameSync(tmp, file);
        res.json({ ok: true });
        return;
      }

      if (!isAdmin(req)) {
        res.status(403).json({ erro: 'acesso negado' });
        return;
      }

      if (action === 'list') {
        ensureDir(SETTINGS.dataDir);
        const files: Array<{ invite: string; file: string; bytes: number }> = [];
        for (const entry of fs.readdirSync(SETTINGS.dataDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const invite = entry.name;
          const subDir = path.join(SETTINGS.dataDir, invite);
          for (const f of fs.readdirSync(subDir)) {
            if (validName(invite, f)) {
              const st = fs.statSync(path.join(subDir, f));
              files.push({ invite, file: f, bytes: st.size });
            }
          }
        }
        res.json({ arquivos: files });
        return;
      }

      const invite = String(req.query.invite || '');
      const name = String(req.query.file || '');
      if (!validName(invite, name)) {
        res.status(400).json({ erro: 'arquivo inválido' });
        return;
      }
      const targetPath = path.join(SETTINGS.dataDir, invite, name);

      if (action === 'get') {
        if (!fs.existsSync(targetPath)) {
          res.status(404).json({ erro: 'não encontrado' });
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        fs.createReadStream(targetPath).pipe(res);
        return;
      }

      if (action === 'delete') {
        if (req.method !== 'POST') {
          res.status(405).json({ erro: 'use POST' });
          return;
        }
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        const subDir = path.join(SETTINGS.dataDir, invite);
        if (fs.existsSync(subDir) && fs.readdirSync(subDir).length === 0) {
          fs.rmdirSync(subDir);
        }
        res.json({ ok: true });
        return;
      }

      res.status(404).json({ erro: 'ação desconhecida' });
    });
  });

  const handleExportZip = async (req: express.Request, res: express.Response) => {
    try {
      const rootDir = process.cwd();
      await ensureCompiledBuild(rootDir);

      const zip = new JSZip();
      const includeRoots = [
        'dist',
        'server.js',
        'index.html',
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'metadata.json',
        '.env.example',
        '.gitignore',
        'README.md',
        'server.ts',
        'src',
        'admin',
        'database',
        'public',
      ];

      const addPathToZip = (absPath: string, relPath: string) => {
        if (!fs.existsSync(absPath)) return;
        const stat = fs.statSync(absPath);
        if (stat.isDirectory()) {
          for (const entry of fs.readdirSync(absPath)) {
            if (entry === 'node_modules' || entry === '.git') continue;
            addPathToZip(path.join(absPath, entry), path.posix.join(relPath, entry));
          }
        } else if (stat.isFile()) {
          zip.file(relPath, fs.readFileSync(absPath));
        }
      };

      for (const item of includeRoots) {
        addPathToZip(path.join(rootDir, item), item);
      }

      // Inclui envelopes armazenados em SETTINGS.dataDir sem incluir .dev-keys.json ou admin-config.json
      if (fs.existsSync(SETTINGS.dataDir)) {
        for (const entry of fs.readdirSync(SETTINGS.dataDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const inviteDir = path.join(SETTINGS.dataDir, entry.name);
          for (const f of fs.readdirSync(inviteDir)) {
            if (validName(entry.name, f)) {
              zip.file(
                path.posix.join('data/envelopes', entry.name, f),
                fs.readFileSync(path.join(inviteDir, f))
              );
            }
          }
        }
      }

      const body = req.body && typeof req.body === 'object' ? req.body : null;
      if (body && body.localState) {
        zip.file(
          'database/local-session-snapshot.json',
          JSON.stringify(body.localState, null, 2)
        );
      }

      const buf = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="projeto-atencao-compilado.zip"');
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    } catch (err) {
      res.status(500).json({ erro: err instanceof Error ? err.message : 'Falha ao gerar ZIP' });
    }
  };

  app.get('/api/export-zip', handleExportZip);
  app.post('/api/export-zip', express.json({ limit: '10mb' }), handleExportZip);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('./dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Projeto Atenção ativo em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
