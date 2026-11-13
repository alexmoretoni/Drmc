import React, { useState } from 'react';
import { AttentionState, StageId } from '../types/protocol';
import { getNextStage, STAGE_META, STAGE_ORDER } from '../engine/stages';

interface HubViewProps {
  state: AttentionState;
  isRemote: boolean;
  onStartStage: (stage: StageId) => void;
  onOpenReport: () => void;
  onWipeAll: () => void;
}

export const HubView: React.FC<HubViewProps> = ({
  state,
  isRemote,
  onStartStage,
  onOpenReport,
  onWipeAll,
}) => {
  const [confirmStage, setConfirmStage] = useState<StageId | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const nextStage = getNextStage(state);
  const totalTrials = state.rows.filter((r) => r.tipo !== 'nota').length;
  const completedCount = STAGE_ORDER.filter((id) => Boolean(state.done[id])).length;
  const completionPct = Math.round((completedCount / STAGE_ORDER.length) * 100);

  const renderSession = (session: 1 | 2, heading: string, subtitle: string) => {
    const stages = STAGE_ORDER.filter((id) => STAGE_META[id].session === session);
    const doneInSession = stages.filter((id) => Boolean(state.done[id])).length;

    return (
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 pb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {doneInSession}/{stages.length} concluídas
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {stages.map((id) => {
            const meta = STAGE_META[id];
            const isDone = Boolean(state.done[id]);
            const isNext = id === nextStage;
            const isOutOfOrder = Boolean(state.ooo[id]);
            const isConfirming = confirmStage === id;

            return (
              <div
                key={id}
                className={`px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 ${
                  isNext ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`w-10 shrink-0 font-mono text-sm tabular-nums ${
                      isNext ? 'font-bold text-blue-600' : 'text-slate-400'
                    }`}
                  >
                    {meta.codeLabel}
                  </span>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{meta.title}</span>
                      {isDone && (
                        <span className="text-xs font-medium text-emerald-700">· Concluída</span>
                      )}
                      {isOutOfOrder && (
                        <span className="text-xs font-medium text-amber-700">· Fora de ordem</span>
                      )}
                      {isNext && !isDone && (
                        <span className="text-xs font-medium text-blue-600">· Próxima recomendada</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {meta.description} · cerca de {meta.minutes} min
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {isConfirming ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmStage(null);
                          onStartStage(id);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 whitespace-nowrap cursor-pointer"
                      >
                        Confirmar: substitui dados
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmStage(null)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (isDone) {
                          setConfirmStage(id);
                        } else {
                          onStartStage(id);
                        }
                      }}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        isNext
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-100 text-slate-800 border border-slate-200 hover:border-blue-500 hover:text-blue-700'
                      }`}
                    >
                      {isDone ? 'Refazer' : isNext ? 'Iniciar' : 'Abrir'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {isRemote ? 'Avaliação de Atenção e Regras' : 'Protocolo de Inferência de Regra Latente'}
          </h1>
          <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
            {isRemote
              ? 'Faça as partes na ordem indicada, em um lugar tranquilo, sem interrupções e sempre neste mesmo aparelho. Você pode pausar entre as partes e retomar depois.'
              : 'Bateria experimental em ordem fixa entre sessões. Utilize teclado (teclas 1, 2, 3) ou toque em ambiente controlado e sempre no mesmo aparelho.'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-slate-500">Progresso do protocolo</div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-slate-600">
                <span>
                  {completedCount} de {STAGE_ORDER.length} etapas finalizadas
                </span>
                {state.code && !isRemote && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Participante: <strong className="text-slate-900">{state.code}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Forma {state.form}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>
                  {isRemote
                    ? `${totalTrials} registros enviados de forma criptografada`
                    : `${totalTrials} registros salvos localmente`}
                </span>
              </div>
            </div>

            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {completionPct}%
            </div>
          </div>

          <div
            role="progressbar"
            aria-label="Porcentagem de conclusão do protocolo"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden"
          >
            <div
              className={`h-full transition-all duration-300 ${
                completionPct === 100 ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </section>

      {renderSession(1, 'Sessão 1', 'Duração estimada: cerca de 45 minutos')}
      {renderSession(2, 'Sessão 2', 'Aplicar em outro dia · cerca de 30 minutos')}

      {!isRemote && (
        <section className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenReport}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Ver relatório individual
            </button>
          </div>

          <div className="flex items-center gap-2">
            {confirmWipe ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmWipe(false);
                    onWipeAll();
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Confirmar: apagar tudo sem volta
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmWipe(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
              >
                Apagar todos os dados
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
};
