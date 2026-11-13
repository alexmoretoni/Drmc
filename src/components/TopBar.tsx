import React from 'react';
import { StageId } from '../types/protocol';

export type AppView = 'hub' | 'report' | 'protocol' | 'tools';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  isRemote: boolean;
  nextStage?: StageId;
  nextStageLabel?: string;
  onStartNext?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onNavigate,
  isRemote,
  nextStage,
  nextStageLabel,
  onStartNext,
}) => {
  const navItems: Array<{ id: AppView; label: string }> = isRemote
    ? [{ id: 'hub', label: 'Protocolo' }]
    : [
        { id: 'hub', label: 'Protocolo' },
        { id: 'report', label: 'Relatório' },
        { id: 'protocol', label: 'Alterações' },
        { id: 'tools', label: 'Ferramentas' },
      ];

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('hub')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 rounded"
        >
          Projeto Atenção
        </button>

        <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Navegação principal">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          {nextStage && onStartNext ? (
            <button
              type="button"
              onClick={onStartNext}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {nextStageLabel || 'Iniciar próxima'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(isRemote ? 'hub' : 'report')}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isRemote ? 'Sessões' : 'Ver relatório'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
