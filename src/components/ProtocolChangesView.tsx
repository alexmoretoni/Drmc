import React from 'react';
import { PROTOCOL_CHANGES } from '../engine/stages';

export const ProtocolChangesView: React.FC = () => {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          O que foi alterado em relação ao protocolo original
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
          Documentação técnica das calibrações, controles de lapso, janelas de reversão e critérios adotados nesta revisão do instrumento.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">Fase</th>
                <th className="py-3 px-4">Especificação implementada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {PROTOCOL_CHANGES.map((item) => (
                <tr key={item.phase} className="align-top hover:bg-slate-50/70">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {item.phase}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 leading-relaxed">{item.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};
