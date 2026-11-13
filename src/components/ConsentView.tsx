import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface ConsentViewProps {
  onAccept: () => void;
}

export const ConsentView: React.FC<ConsentViewProps> = ({ onAccept }) => {
  const [checked, setChecked] = useState(false);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Avaliação clínica criptografada</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Antes de começar</h1>
        </div>

        <div className="space-y-4 text-slate-700 text-base leading-relaxed">
          <p>
            Esta tarefa faz parte da sua avaliação com o seu médico. Ela observa como você
            aprende e usa regras simples, levando cerca de 45 minutos em um dia e 30 minutos
            em outro.
          </p>
          <p>
            Suas respostas e tempos de resposta são enviados ao consultório de forma
            criptografada: apenas o consultório consegue abri-los. Este site repassa os dados
            em envelope fechado e os remove após o recebimento.
          </p>
          <p>
            Você pode parar entre as partes e continuar depois, neste mesmo aparelho e navegador.
          </p>
        </div>

        <label className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span className="text-sm font-medium text-slate-900">
            Li as orientações e concordo em participar desta avaliação.
          </span>
        </label>

        <div className="flex items-center justify-end">
          <button
            type="button"
            disabled={!checked}
            onClick={onAccept}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Continuar
          </button>
        </div>
      </div>
    </main>
  );
};
