# Estrutura de Dados e Envelopes

Este aplicativo não depende de um servidor de banco de dados SQL externo: os envios remotos são gravados atomicamente como arquivos JSON individuais dentro de `ENVELOPE_DATA_DIR` (`./data/envelopes/<invite_id>/<kind>-<submission>.json`).

## Formato do Envelope Criptografado

```json
{
  "v": 1,
  "kind": "stage | partial",
  "submission": "id_unico",
  "n": 120,
  "key": "<AES-256 key wrapped with RSA-OAEP-256 (base64)>",
  "iv": "<12-byte GCM IV (base64)>",
  "data": "<AES-GCM ciphertext of TrialRow[] + stage summary (base64)>",
  "recebido": "2026-11-13T00:00:00.000Z"
}
```

## Snapshot Local

Ao exportar o pacote `.zip` pela interface administrativa (**Ferramentas**), caso haja dados locais no navegador atual, uma cópia é salva em `database/local-session-snapshot.json` para arquivamento imediato.
