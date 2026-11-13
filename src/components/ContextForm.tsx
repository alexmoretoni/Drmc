import React, { useEffect, useState } from 'react';
import { AttentionState, ContextData, FormCode, InvitePayload } from '../types/protocol';

interface ContextFormProps {
  state: AttentionState;
  invite: InvitePayload | null;
  onSubmit: (code: string, form: FormCode, ctx: ContextData) => void;
  onCancel: () => void;
}

const ALL_FIELDS: Array<keyof ContextData> = ['idade', 'escolaridade', 'sono', 'subst', 'med', 'dx'];

export const ContextForm: React.FC<ContextFormProps> = ({ state, invite, onSubmit, onCancel }) => {
  const isRemote = Boolean(invite);
  const allowedRemote = new Set(invite?.a || []);
  const hidden = new Set<string>(
    isRemote ? ALL_FIELDS.filter((k) => !allowedRemote.has(k)) : []
  );

  const [code, setCode] = useState(invite ? invite.i : state.code || '');
  const [form, setForm] = useState<FormCode>(invite?.f === 'B' ? 'B' : state.form || 'A');
  const [ctx, setCtx] = useState<ContextData>({
    idade: state.ctx.idade || '',
    escolaridade: state.ctx.escolaridade || '',
    sono: state.ctx.sono || '',
    subst: state.ctx.subst || '',
    med: state.ctx.med || '',
    dx: state.ctx.dx || '',
  });
  const [error, setError] = useState('');

  const nothingToAsk = isRemote && ALL_FIELDS.every((k) => hidden.has(k));

  useEffect(() => {
    if (nothingToAsk && invite) {
      onSubmit(invite.i, invite.f === 'B' ? 'B' : 'A', {
        ...state.ctx,
        code: invite.i,
        modo: 'remoto',
        dispositivo: `${navigator.userAgent} | tela ${screen.width}x${screen.height} | toque ${navigator.maxTouchPoints > 0 ? 'sim' : 'não'}`,
        consentimento: state.consent || '',
      });
    }
  }, [nothingToAsk, invite, onSubmit, state.consent, state.ctx]);

  if (nothingToAsk) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Informe um código de participante, por exemplo P001.');
      return;
    }
    const nextCtx: ContextData = {
      ...ctx,
      code: trimmed,
    };
    if (isRemote) {
      nextCtx.modo = 'remoto';
      nextCtx.dispositivo = `${navigator.userAgent} | tela ${screen.width}x${screen.height} | toque ${navigator.maxTouchPoints > 0 ? 'sim' : 'não'}`;
      nextCtx.consentimento = state.consent || '';
    }
    onSubmit(trimmed, form, nextCtx);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contexto desta aplicação</h1>
            <p className="text-sm text-slate-600">
              {isRemote
                ? 'Algumas perguntas rápidas antes de iniciar. Todos os campos abaixo são opcionais.'
                : 'Todos os campos clínicos são opcionais, exceto o código do participante. Os dados permanecem neste navegador até a exportação.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isRemote && (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Código do participante</span>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Ex.: P001"
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Forma da sequência</span>
                  <select
                    value={form}
                    onChange={(e) => setForm(e.target.value as FormCode)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="A">A (primeira aplicação)</option>
                    <option value="B">B (reteste, outra sequência)</option>
                  </select>
                </label>
              </>
            )}

            {!hidden.has('idade') && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Idade</span>
                <input
                  type="number"
                  min={0}
                  value={ctx.idade || ''}
                  onChange={(e) => setCtx({ ...ctx, idade: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm tabular-nums focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>
            )}

            {!hidden.has('escolaridade') && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Anos de estudo</span>
                <input
                  type="number"
                  min={0}
                  value={ctx.escolaridade || ''}
                  onChange={(e) => setCtx({ ...ctx, escolaridade: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm tabular-nums focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>
            )}

            {!hidden.has('sono') && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Horas de sono na noite anterior</span>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={ctx.sono || ''}
                  onChange={(e) => setCtx({ ...ctx, sono: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm tabular-nums focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>
            )}

            {!hidden.has('subst') && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Cafeína, álcool ou outras substâncias hoje</span>
                <input
                  type="text"
                  value={ctx.subst || ''}
                  onChange={(e) => setCtx({ ...ctx, subst: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>
            )}

            {!hidden.has('med') && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Medicação em uso hoje</span>
                <input
                  type="text"
                  value={ctx.med || ''}
                  onChange={(e) => setCtx({ ...ctx, med: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>
            )}

            {!hidden.has('dx') && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>Diagnósticos</span>
                <input
                  type="text"
                  value={ctx.dx || ''}
                  onChange={(e) => setCtx({ ...ctx, dx: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>
            )}
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Salvar e voltar
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
