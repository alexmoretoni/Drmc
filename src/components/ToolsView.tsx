import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Download, KeyRound, RefreshCw, Save, Trash2 } from 'lucide-react';
import { AttentionState, FormCode, RemoteConfig, StageId } from '../types/protocol';
import { STAGE_META, STAGE_ORDER } from '../engine/stages';

interface ToolsViewProps {
  state: AttentionState;
  remoteConfig: RemoteConfig | null;
  onStartAutoStage: (stage: StageId, accuracy: number, speed: number) => void;
  onImportJson: (next: AttentionState) => void;
  onOpenReport: () => void;
}

const CONTEXT_FIELDS = [
  { key: 'idade', label: 'Idade' },
  { key: 'escolaridade', label: 'Escolaridade' },
  { key: 'sono', label: 'Sono' },
  { key: 'subst', label: 'Substâncias' },
  { key: 'med', label: 'Medicação' },
  { key: 'dx', label: 'Diagnósticos' },
];

export const ToolsView: React.FC<ToolsViewProps> = ({
  state,
  remoteConfig,
  onStartAutoStage,
  onImportJson,
  onOpenReport,
}) => {
  const [accuracy, setAccuracy] = useState(0.85);
  const [speed, setSpeed] = useState(200);
  const [selectedStage, setSelectedStage] = useState<StageId>('2D');
  const [inviteForm, setInviteForm] = useState<FormCode>('A');
  const [inviteFields, setInviteFields] = useState<string[]>(['idade', 'escolaridade', 'sono']);
  const [inviteLink, setInviteLink] = useState('');

  const [adminToken, setAdminToken] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [inviteKeyHex, setInviteKeyHex] = useState('');
  const [newAdminToken, setNewAdminToken] = useState('');
  const [dataDir, setDataDir] = useState('./data/envelopes');
  const [maxBytesMb, setMaxBytesMb] = useState('3');
  const [maxFiles, setMaxFiles] = useState('600');
  const [publicJwkJson, setPublicJwkJson] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [envelopes, setEnvelopes] = useState<Array<{ invite: string; file: string; bytes: number }> | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const loadAdminSettings = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'X-Polar-Token': tokenToUse.trim() },
      });
      if (!res.ok) {
        setSettingsLoaded(false);
        return;
      }
      const data = await res.json();
      setInviteKeyHex(data.inviteKeyHex || '');
      setDataDir(data.dataDir || './data/envelopes');
      setMaxBytesMb(String(Math.round((Number(data.maxBytes || 3145728) / (1024 * 1024)) * 100) / 100));
      setMaxFiles(String(data.maxFiles || 600));
      setPublicJwkJson(JSON.stringify(data.publicJwk || {}, null, 2));
      setSettingsLoaded(true);
    } catch {
      setSettingsLoaded(false);
    }
  }, []);

  useEffect(() => {
    if (remoteConfig?.devAdminToken && !adminToken) {
      setAdminToken(remoteConfig.devAdminToken);
      void loadAdminSettings(remoteConfig.devAdminToken);
    }
  }, [remoteConfig?.devAdminToken, adminToken, loadAdminSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken.trim()) {
      setStatusMsg('Informe o token administrativo atual para salvar as variáveis.');
      return;
    }
    setSavingSettings(true);
    setStatusMsg('');
    try {
      const parsedJwk = JSON.parse(publicJwkJson);
      const maxBytes = Math.round(Number(maxBytesMb) * 1024 * 1024);
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Polar-Token': adminToken.trim(),
        },
        body: JSON.stringify({
          inviteKeyHex: inviteKeyHex.trim(),
          newAdminToken: newAdminToken.trim() || undefined,
          dataDir: dataDir.trim(),
          maxBytes,
          maxFiles: Number(maxFiles),
          publicJwk: parsedJwk,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao salvar configurações');
      if (newAdminToken.trim()) {
        setAdminToken(newAdminToken.trim());
        setNewAdminToken('');
      }
      setStatusMsg('Variáveis salvas no servidor e aplicadas imediatamente.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao salvar variáveis');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRandomInviteKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    setInviteKeyHex(hex);
  };

  const handleDownloadZip = async () => {
    setZipLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/export-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localState: state }),
      });
      if (!res.ok) throw new Error('Falha ao compilar e gerar arquivo .zip');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'projeto-atencao-compilado.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      setStatusMsg('Pacote compilado (.zip) baixado com sucesso.');
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Erro ao baixar .zip');
    } finally {
      setZipLoading(false);
    }
  };

  const toggleInviteField = (field: string) => {
    setInviteFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleGenerateInvite = async () => {
    setStatusMsg('');
    try {
      const res = await fetch('/api/dev/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken.trim() ? { 'X-Polar-Token': adminToken.trim() } : {}),
        },
        body: JSON.stringify({
          form: inviteForm,
          fields: inviteFields,
        }),
      });
      if (!res.ok) throw new Error('Falha ao gerar convite (verifique o token administrativo)');
      const data = await res.json();
      const url = `${window.location.origin}/#c=${data.token}`;
      setInviteLink(url);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Erro ao gerar link');
    }
  };

  const handleListEnvelopes = async () => {
    if (!adminToken.trim()) {
      setStatusMsg('Informe o token administrativo (X-Polar-Token).');
      return;
    }
    setStatusMsg('');
    try {
      const res = await fetch('/api/envelope?action=list', {
        headers: { 'X-Polar-Token': adminToken.trim() },
      });
      if (!res.ok) throw new Error('Token inválido ou acesso negado');
      const data = await res.json();
      setEnvelopes(data.arquivos || []);
      if (!settingsLoaded) {
        void loadAdminSettings(adminToken.trim());
      }
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Erro ao listar envelopes');
    }
  };

  const handleDownloadEnvelope = async (invite: string, file: string) => {
    try {
      const res = await fetch(
        `/api/envelope?action=get&invite=${encodeURIComponent(invite)}&file=${encodeURIComponent(file)}`,
        { headers: { 'X-Polar-Token': adminToken.trim() } }
      );
      if (!res.ok) throw new Error('Falha ao baixar envelope');
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invite}_${file}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Erro ao baixar envelope');
    }
  };

  const handleDeleteEnvelope = async (invite: string, file: string) => {
    try {
      const res = await fetch(
        `/api/envelope?action=delete&invite=${encodeURIComponent(invite)}&file=${encodeURIComponent(file)}`,
        { method: 'POST', headers: { 'X-Polar-Token': adminToken.trim() } }
      );
      if (!res.ok) throw new Error('Falha ao excluir envelope');
      setEnvelopes((prev) =>
        prev ? prev.filter((item) => !(item.invite === invite && item.file === file)) : prev
      );
      setConfirmDeleteKey(null);
      setStatusMsg(`Envelope ${file} removido do servidor.`);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Erro ao excluir envelope');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.rows)) {
          setStatusMsg('Arquivo JSON inválido para o Projeto Atenção.');
          return;
        }
        onImportJson(parsed);
        setStatusMsg('Backup JSON restaurado com sucesso.');
      } catch {
        setStatusMsg('Não foi possível ler o arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Administração, Variáveis e Pacote Compilado (.zip)
        </h1>
        <p className="text-sm text-slate-600">
          Configure variáveis do servidor pela interface, baixe o sistema compilado pronto para deploy e gerencie convites e envelopes.
        </p>
      </div>

      {statusMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm font-medium text-blue-900">
          {statusMsg}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Baixar sistema compilado (.zip)
            </h2>
            <p className="text-sm text-slate-600">
              Empacota o build de produção compilado (<span className="font-mono text-xs text-slate-800">dist/</span> e <span className="font-mono text-xs text-slate-800">server.js</span>), código-fonte, utilitários <span className="font-mono text-xs text-slate-800">admin/</span>, estrutura/envelopes em <span className="font-mono text-xs text-slate-800">data/envelopes/</span> e o snapshot local. As variáveis são configuradas diretamente pelo painel Admin abaixo após subir o sistema.
            </p>
          </div>
          <button
            type="button"
            disabled={zipLoading}
            onClick={handleDownloadZip}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shrink-0 cursor-pointer"
          >
            <Archive className="w-4 h-4" aria-hidden="true" />
            <span>{zipLoading ? 'Compilando e gerando .zip...' : 'Baixar compilado (.zip)'}</span>
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900">
                Variáveis do sistema (Admin)
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Defina <span className="font-mono text-xs">INVITE_KEY</span>, token administrativo, chave pública RSA e limites de armazenamento sem editar arquivos <span className="font-mono text-xs">.env</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pb-4 border-b border-slate-200">
          <label className="flex-1 min-w-[220px] flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Token administrativo atual (X-Polar-Token)</span>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Informe o token para carregar e editar variáveis"
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadAdminSettings(adminToken)}
            className="px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:border-blue-500 cursor-pointer"
          >
            Carregar variáveis
          </button>
        </div>

        {settingsLoaded ? (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="sm:col-span-2 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span>INVITE_KEY (64 hex chars / assinatura de convites)</span>
                  <button
                    type="button"
                    onClick={handleRandomInviteKey}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    <span>Gerar nova chave</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={inviteKeyHex}
                  onChange={(e) => setInviteKeyHex(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Novo token administrativo (opcional, mín. 8 chars)</span>
                <input
                  type="password"
                  value={newAdminToken}
                  onChange={(e) => setNewAdminToken(e.target.value)}
                  placeholder="Deixe vazio para manter o token atual"
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>ENVELOPE_DATA_DIR (pasta dos envelopes)</span>
                <input
                  type="text"
                  value={dataDir}
                  onChange={(e) => setDataDir(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Tamanho máximo por envio (MB)</span>
                <input
                  type="number"
                  min={0.1}
                  max={50}
                  step={0.5}
                  value={maxBytesMb}
                  onChange={(e) => setMaxBytesMb(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>MAX_FILES por convite</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={maxFiles}
                  onChange={(e) => setMaxFiles(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                />
              </label>

              <label className="sm:col-span-2 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>POLAR_PUBLIC_JWK (chave pública RSA-OAEP-256 em JSON)</span>
                <textarea
                  value={publicJwkJson}
                  onChange={(e) => setPublicJwkJson(e.target.value)}
                  rows={5}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{savingSettings ? 'Salvando...' : 'Salvar variáveis no servidor'}</span>
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-slate-500">
            Informe um token administrativo válido acima e clique em <strong>Carregar variáveis</strong> para editar as configurações do servidor.
          </p>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Convites remotos e cofre de envelopes
          </h2>
          <p className="text-sm text-slate-600">
            Crie links assinados por HMAC-SHA256 e gerencie os envelopes criptografados armazenados no servidor.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              <span>Forma</span>
              <select
                value={inviteForm}
                onChange={(e) => setInviteForm(e.target.value as FormCode)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
              >
                <option value="A">Forma A</option>
                <option value="B">Forma B</option>
              </select>
            </label>

            <button
              type="button"
              onClick={handleGenerateInvite}
              className="px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:border-blue-500 cursor-pointer"
            >
              Gerar link de convite
            </button>

            <button
              type="button"
              onClick={handleListEnvelopes}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-400 cursor-pointer"
            >
              Listar envelopes no servidor
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
            <span className="font-medium text-slate-500">Campos visíveis ao paciente:</span>
            {CONTEXT_FIELDS.map((f) => (
              <label key={f.key} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteFields.includes(f.key)}
                  onChange={() => toggleInviteField(f.key)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {inviteLink && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="text-xs font-medium text-slate-600">Link assinado para envio remoto:</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800"
              />
              <a
                href={inviteLink}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 whitespace-nowrap"
              >
                Abrir link
              </a>
            </div>
          </div>
        )}

        {envelopes !== null && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="text-xs font-medium text-slate-600 font-mono tabular-nums">
              {envelopes.length} envelope(s) criptografado(s) armazenado(s):
            </div>
            {envelopes.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200 text-xs font-mono tabular-nums">
                {envelopes.map((ev) => {
                  const key = `${ev.invite}/${ev.file}`;
                  const confirming = confirmDeleteKey === key;
                  return (
                    <div key={key} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-slate-800 truncate">{key}</span>
                        <span className="text-slate-500">{ev.bytes} B</span>
                      </div>
                      <div className="flex items-center gap-2 font-sans">
                        <button
                          type="button"
                          onClick={() => handleDownloadEnvelope(ev.invite, ev.file)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:border-blue-500 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Baixar</span>
                        </button>
                        {confirming ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeleteEnvelope(ev.invite, ev.file)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 cursor-pointer"
                            >
                              Confirmar exclusão
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteKey(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(key)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Simulador sintético de fase</h2>
          <p className="text-sm text-slate-600">
            Executa automaticamente uma fase inteira com acurácia e velocidade configuráveis para validar sequências e visualizar o relatório computacional.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Fase alvo</span>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as StageId)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
            >
              {STAGE_ORDER.map((id) => (
                <option key={id} value={id}>
                  {STAGE_META[id].title} ({id})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Taxa de acerto alvo ({Math.round(accuracy * 100)}%)</span>
            <input
              type="range"
              min={0.35}
              max={0.98}
              step={0.05}
              value={accuracy}
              onChange={(e) => setAccuracy(Number(e.target.value))}
              className="mt-2 accent-blue-600"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Aceleração ({speed}×)</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono"
            >
              <option value={20}>20× (visual)</option>
              <option value={100}>100× (rápido)</option>
              <option value={250}>250× (instantâneo)</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onStartAutoStage(selectedStage, accuracy, speed)}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            Executar fase simulada
          </button>
          <button
            type="button"
            onClick={onOpenReport}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            Abrir relatório atual ({state.rows.length} linhas)
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Restaurar backup JSON</h2>
        <p className="text-sm text-slate-600">
          Carregue um arquivo exportado anteriormente pelo Projeto Atenção para inspecionar o relatório.
        </p>
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleFileImport}
          className="text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-slate-200 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
        />
      </section>
    </main>
  );
};
