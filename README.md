# Projeto Atenção

Bateria cognitiva de inferência de regra latente, atenção seletiva, reversão de contingências, aprendizagem probabilística, bloqueio (*blocking*) e controle executivo (Corsi, Dígitos Inversos e Velocidade), com modelagem computacional bayesiana e receptor de envelopes criptografados ponta a ponta.

## Execução rápida do pacote compilado

Se você baixou o arquivo `projeto-atencao-compilado.zip`, ele já inclui os artefatos compilados (`dist/` e `server.js`):

```bash
npm install --omit=dev
NODE_ENV=production node server.js
```

O servidor inicia na porta `3000` (ou `PORT` definida no ambiente).

## Configuração de variáveis pelo Admin

Não é obrigatório editar arquivos `.env` manualmente. Ao acessar a aba **Ferramentas → Variáveis do Sistema (Admin)** na interface web, você pode definir e salvar diretamente no servidor:

- `INVITE_KEY` (chave HMAC-SHA256 de 64 caracteres hexadecimais para assinar convites)
- `ADMIN_TOKEN` (convertido em hash SHA-256 no servidor para proteger consultas e alterações)
- `POLAR_PUBLIC_JWK` (chave pública RSA-OAEP-256 para criptografia dos envelopes)
- `ENVELOPE_DATA_DIR`, `MAX_BYTES` e `MAX_FILES`

As configurações salvas pelo painel ficam armazenadas em `./data/admin-config.json` (com permissão restrita `0600`) e passam a valer imediatamente. Caso prefira, variáveis de ambiente tradicionais (`.env`) também continuam compatíveis.

## Desenvolvimento e recompilação

```bash
npm install
npm run dev
```

Para recompilar frontend e servidor:

```bash
npm run build:compiled
```
