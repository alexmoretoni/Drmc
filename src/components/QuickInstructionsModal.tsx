import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { STAGE_META } from '../engine/stages';
import { StageId } from '../types/protocol';
import { ExampleSequence, SymbolLegend } from './StimulusSvg';

interface QuickInstructionsModalProps {
  stageId: StageId;
  open: boolean;
  onClose: () => void;
}

interface StageQuickGuide {
  goal: string;
  controls: string;
  tips: string[];
  showRuleExamples?: boolean;
  symbols?: [string, string];
}

function getGuideForStage(stageId: StageId): StageQuickGuide {
  switch (stageId) {
    case '1A':
    case '1R':
      return {
        goal: 'Observe a regra escrita no topo (REPETIÇÃO ou EXCLUSÃO) e escolha a terceira figura correta entre as 3 opções abaixo.',
        controls: 'Pressione as teclas 1, 2 ou 3 no teclado, ou toque diretamente na caixa desejada.',
        tips: [
          'Repetição: escolha a figura com a mesma forma da primeira.',
          'Exclusão: escolha a figura com forma diferente das duas primeiras.',
          'Cor e tamanho variam entre as caixas e devem ser ignorados.',
        ],
        showRuleExamples: true,
      };
    case '1B':
      return {
        goal: 'O nome da regra não aparece mais. Um símbolo (Lua ou Sol) indica qual regra vale na tentativa. Descubra o significado pelo feedback.',
        controls: 'Teclas 1, 2 ou 3 (ou toque na opção). Limite de 6 segundos por tentativa.',
        tips: [
          'Cada símbolo representa sempre uma das duas regras (Repetição ou Exclusão).',
          'Observe o feedback ("Correto" ou "Incorreto") para confirmar sua hipótese.',
        ],
        showRuleExamples: true,
        symbols: ['lua', 'sol'],
      };
    case '2T':
      return {
        goal: 'Os símbolos aparecem em uma fileira de 7 posições. Alguns indicam a regra e outros são distratores sem significado.',
        controls: 'Teclas 1, 2 ou 3 (ou toque). Você tem até 6 segundos por escolha.',
        tips: [
          'Lua e Sol mantêm o mesmo significado aprendido antes.',
          'Use o feedback para descobrir quais novos símbolos indicam cada regra.',
        ],
        showRuleExamples: true,
      };
    case '2CAL':
      return {
        goal: 'Os símbolos da fileira piscam brevemente e somem antes das figuras. O tempo se ajusta automaticamente ao seu desempenho.',
        controls: 'Teclas 1, 2 ou 3 (ou toque). Não há feedback nesta etapa.',
        tips: [
          'Mantenha o foco no centro da tela durante a cruz de fixação (+).',
          'É esperado que a tarefa pareça difícil; responda com sua melhor estimativa.',
        ],
      };
    case '2A':
      return {
        goal: 'Com figuras inéditas e tempo calibrado, identifique a regra pela palavra (quando visível) ou pelos símbolos na fileira.',
        controls: 'Teclas 1, 2 ou 3 (ou toque). Sem feedback após as respostas.',
        tips: [
          'Em metade das tentativas a palavra da regra substitui os símbolos informativos.',
          'Ignore cor e tamanho das figuras; apenas a forma define igualdade.',
        ],
      };
    case '2B':
      return {
        goal: 'Dois novos símbolos (Losango e Estrela) passam a indicar as regras. Descubra a associação e aplique depois em figuras inéditas.',
        controls: 'Teclas 1, 2 ou 3 (ou toque).',
        tips: [
          'Na primeira etapa há feedback; nas etapas finais de teste não há feedback.',
          'Se descobrir qual regra um símbolo indica, você pode deduzir o outro por exclusão.',
        ],
        symbols: ['losango', 'estrela'],
      };
    case '2C':
      return {
        goal: 'Lua e Sol voltam com feedback, mas a associação entre símbolos e regras pode se inverter durante o bloco.',
        controls: 'Teclas 1, 2 ou 3 (ou toque).',
        tips: [
          'Se o feedback indicar erro consistente, considere que as regras dos símbolos inverteram.',
          'Em algumas tentativas aparecem outros símbolos sem feedback; responda como achar mais provável.',
        ],
        symbols: ['lua', 'sol'],
      };
    case '2P':
      return {
        goal: 'Lua e Sol continuam indicando a regra mais provável, mas em cerca de 20% das tentativas vale a regra oposta (exceções).',
        controls: 'Teclas 1, 2 ou 3 (ou toque). O feedback é sempre verdadeiro.',
        tips: [
          'Uma única exceção isolada não significa que a regra mudou.',
          'Mude de estratégia apenas quando os erros se repetirem de forma consistente.',
        ],
        symbols: ['lua', 'sol'],
      };
    case '2D':
    case '2DR':
      return {
        goal: 'Nenhum símbolo aparece. Uma das regras está oculta e muda sem aviso de tempos em tempos. Além disso, parte do feedback é ruidoso.',
        controls: 'Teclas 1, 2 ou 3 (ou toque). Em algumas tentativas, avalie sua confiança de 1 a 4.',
        tips: [
          'Como o feedback pode enganar isoladamente, baseie sua decisão no conjunto das últimas tentativas.',
          'Na escala de confiança: 1 significa chute e 4 significa certeza.',
        ],
        showRuleExamples: true,
      };
    case '3':
      return {
        goal: 'Novos símbolos aparecem primeiro sozinhos, depois em pares e por fim são avaliados em escolha, nota (1–7) e reconhecimento.',
        controls: 'Teclas 1, 2, 3 nas escolhas; teclas 1–7 nas notas; teclas 1 (Sim) ou 2 (Não) no reconhecimento.',
        tips: [
          'Preste atenção a todos os símbolos apresentados nos pares.',
          'Na escala de 1 a 7: 1 = certamente Repetição, 4 = neutro, 7 = certamente Exclusão.',
        ],
      };
    case 'corsi':
      return {
        goal: 'Observe os quadrados que se acendem na tela e repita a sequência tocando neles exatamente na mesma ordem.',
        controls: 'Clique ou toque nos quadrados após aparecer a indicação "Sua vez".',
        tips: [
          'Aguarde toda a sequência terminar antes de tocar.',
          'O tamanho da sequência aumenta progressivamente após acertos.',
        ],
      };
    case 'dig':
      return {
        goal: 'Memorize os dígitos exibidos um a um e digite-os na ordem inversa (do último para o primeiro).',
        controls: 'Use o teclado numérico na tela ou as teclas 0–9, Backspace para apagar e Enter/OK para confirmar.',
        tips: [
          'Exemplo: se aparecer 4, 7, 2, você deve digitar 274.',
          'Confira o visor antes de pressionar OK.',
        ],
      };
    case 'spd':
      return {
        goal: 'Durante 60 segundos, julgue o mais rápido possível se as duas figuras exibidas têm exatamente a mesma forma.',
        controls: 'Tecla 1 = Mesma forma · Tecla 2 = Formas diferentes (ou toque nos botões).',
        tips: [
          'Cor e tamanho podem mudar mesmo quando a forma é a mesma.',
          'Tente equilibrar máxima velocidade com precisão.',
        ],
      };
    default:
      return {
        goal: 'Siga as instruções exibidas na tela para completar esta etapa.',
        controls: 'Use o mouse, toque ou teclado conforme indicado.',
        tips: [],
      };
  }
}

export const QuickInstructionsModal: React.FC<QuickInstructionsModalProps> = ({
  stageId,
  open,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const meta = STAGE_META[stageId];
  const guide = getGuideForStage(stageId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-guide-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <div className="text-xs font-mono text-blue-600 font-semibold">
              Instruções Rápidas · {meta.title}
            </div>
            <h2 id="quick-guide-title" className="text-lg font-bold text-slate-900 mt-0.5">
              Como realizar esta tarefa
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar instruções rápidas"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Objetivo
            </h3>
            <p className="text-slate-900">{guide.goal}</p>
          </div>

          <div className="space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Controles
            </h3>
            <p className="text-slate-800 font-medium">{guide.controls}</p>
          </div>

          {guide.symbols && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pistas desta fase
              </h3>
              <SymbolLegend left={guide.symbols[0]} right={guide.symbols[1]} />
            </div>
          )}

          {guide.showRuleExamples && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="text-xs font-semibold text-blue-700">Repetição (igual à 1ª)</div>
                <ExampleSequence goodIndex={0} />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="text-xs font-semibold text-blue-700">Exclusão (figura nova)</div>
                <ExampleSequence goodIndex={2} />
              </div>
            </div>
          )}

          {guide.tips.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pontos importantes
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {guide.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">Pressione Esc para fechar</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            Entendi, voltar
          </button>
        </div>
      </div>
    </div>
  );
};
