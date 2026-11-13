import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AttentionState,
  AutoRunConfig,
  ContextData,
  FormCode,
  RemoteConfig,
  StageId,
} from './types/protocol';
import {
  createFreshState,
  getNextStage,
  PROTOCOL_VERSION,
  STAGE_META,
  STAGE_ORDER,
  STORAGE_KEY,
} from './engine/stages';
import { hasInviteInUrl, parseInviteFromUrl, sendEncryptedEnvelope } from './engine/crypto';
import { AppView, TopBar } from './components/TopBar';
import { ConsentView } from './components/ConsentView';
import { ContextForm } from './components/ContextForm';
import { HubView } from './components/HubView';
import { ReportView } from './components/ReportView';
import { ProtocolChangesView } from './components/ProtocolChangesView';
import { ToolsView } from './components/ToolsView';
import { TaskStage } from './components/TaskStage';

function loadInitialState(inviteId: string | null, inviteForm?: FormCode): AttentionState {
  const key = inviteId ? `${STORAGE_KEY}:${inviteId}` : STORAGE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === PROTOCOL_VERSION) {
        return { ...createFreshState(), ...parsed };
      }
    }
  } catch {
    // ignora storage inválido
  }
  const fresh = createFreshState();
  if (inviteId) {
    fresh.code = inviteId;
    fresh.form = inviteForm === 'B' ? 'B' : 'A';
  }
  return fresh;
}

export default function App() {
  const [urlHash, setUrlHash] = useState(() => window.location.hash + window.location.search);

  useEffect(() => {
    const onHash = () => setUrlHash(window.location.hash + window.location.search);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const inviteAttempted = useMemo(() => {
    void urlHash;
    return hasInviteInUrl();
  }, [urlHash]);

  const invite = useMemo(() => {
    void urlHash;
    return parseInviteFromUrl();
  }, [urlHash]);

  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig | null>(null);
  const [state, setState] = useState<AttentionState>(() =>
    loadInitialState(invite?.i || null, invite?.f)
  );
  const [view, setView] = useState<AppView>('hub');
  const [activeStage, setActiveStage] = useState<StageId | null>(null);
  const [autoRun, setAutoRun] = useState<AutoRunConfig>({
    enabled: false,
    accuracy: 0.85,
    speed: 200,
  });
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    setState(loadInitialState(invite?.i || null, invite?.f));
    setActiveStage(null);
    setView('hub');
  }, [invite?.i, invite?.f]);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg) setRemoteConfig(cfg);
      })
      .catch(() => {
        // servidor offline: modo local continua funcionando
      });
  }, []);

  const persistState = useCallback(
    (next: AttentionState) => {
      setState(next);
      try {
        const key = invite ? `${STORAGE_KEY}:${invite.i}` : STORAGE_KEY;
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignora erro de quota
      }
    },
    [invite]
  );

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const isRemote = Boolean(invite);

  if (inviteAttempted && !invite) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-3">
          <h1 className="text-xl font-bold text-slate-900">Link inválido ou incompleto</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Abra o link exatamente como recebeu, ou peça um novo convite ao consultório.
          </p>
        </div>
      </div>
    );
  }

  if (isRemote && !state.consent) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <TopBar activeView="hub" onNavigate={setView} isRemote />
        <ConsentView
          onAccept={() => {
            persistState({ ...state, consent: new Date().toISOString() });
          }}
        />
      </div>
    );
  }

  if (activeStage === 'ctx') {
    return (
      <div className="min-h-dvh bg-slate-50">
        <TopBar activeView={view} onNavigate={setView} isRemote={isRemote} />
        <ContextForm
          state={state}
          invite={invite}
          onCancel={() => setActiveStage(null)}
          onSubmit={async (code, form, ctx: ContextData) => {
            const idx = STAGE_ORDER.indexOf('ctx');
            const outOfOrder = STAGE_ORDER.slice(0, idx).some(
              (k) => STAGE_META[k].session === 1 && !state.done[k]
            );
            const doneAt = new Date().toISOString();
            const nextState: AttentionState = {
              ...state,
              code,
              form,
              ctx,
              done: { ...state.done, ctx: doneAt },
              ooo: outOfOrder ? { ...state.ooo, ctx: true } : state.ooo,
            };
            if (isRemote && invite && remoteConfig) {
              try {
                await sendEncryptedEnvelope(remoteConfig, invite.token, 'stage', {
                  submission: Date.now().toString(36) + Math.random().toString(36).slice(2),
                  rows: [],
                  stage: 'ctx',
                  v: state.v,
                  form,
                  done: doneAt,
                  ctx,
                } as unknown as { submission: string; rows: [] });
              } catch {
                // seguirá normalmente e salva localmente
              }
            }
            persistState(nextState);
            setActiveStage(null);
            showToast('Contexto salvo.');
          }}
        />
      </div>
    );
  }

  if (activeStage) {
    return (
      <TaskStage
        stageId={activeStage}
        state={state}
        invite={invite}
        remoteConfig={remoteConfig}
        autoRun={autoRun}
        onComplete={(nextState) => {
          persistState(nextState);
          setActiveStage(null);
          setAutoRun((prev) => ({ ...prev, enabled: false }));
          showToast(`${STAGE_META[activeStage].title} concluída.`);
        }}
        onAbort={(msg) => {
          setActiveStage(null);
          setAutoRun((prev) => ({ ...prev, enabled: false }));
          showToast(msg);
        }}
      />
    );
  }

  const nextStage = getNextStage(state);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <TopBar
        activeView={view}
        onNavigate={setView}
        isRemote={isRemote}
        nextStage={nextStage}
        nextStageLabel={nextStage ? `Iniciar ${STAGE_META[nextStage].codeLabel}` : undefined}
        onStartNext={
          nextStage
            ? () => {
                setAutoRun((prev) => ({ ...prev, enabled: false }));
                setActiveStage(nextStage);
              }
            : undefined
        }
      />

      {view === 'hub' && (
        <HubView
          state={state}
          isRemote={isRemote}
          onStartStage={(id) => {
            setAutoRun((prev) => ({ ...prev, enabled: false }));
            setActiveStage(id);
          }}
          onOpenReport={() => setView('report')}
          onWipeAll={() => {
            const fresh = createFreshState();
            persistState(fresh);
            showToast('Todos os dados locais foram apagados.');
          }}
        />
      )}

      {view === 'report' && !isRemote && (
        <ReportView state={state} onBack={() => setView('hub')} />
      )}

      {view === 'protocol' && !isRemote && <ProtocolChangesView />}

      {view === 'tools' && !isRemote && (
        <ToolsView
          state={state}
          remoteConfig={remoteConfig}
          onStartAutoStage={(stageId, accuracy, speed) => {
            if (stageId === 'ctx') {
              persistState({
                ...state,
                code: state.code || 'AUTO',
                done: { ...state.done, ctx: new Date().toISOString() },
              });
              showToast('Contexto simulado salvo.');
              return;
            }
            setAutoRun({ enabled: true, accuracy, speed });
            setActiveStage(stageId);
          }}
          onImportJson={(next) => {
            persistState(next);
            showToast('Dados importados.');
          }}
          onOpenReport={() => setView('report')}
        />
      )}

      {toastMsg && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium z-30">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
