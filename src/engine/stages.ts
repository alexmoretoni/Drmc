import { AttentionState, StageId } from '../types/protocol';

export interface StageMeta {
  id: StageId;
  session: 1 | 2;
  codeLabel: string;
  title: string;
  description: string;
  minutes: number;
}

export const STAGE_ORDER: StageId[] = [
  'ctx', '1A', '1B', '2T', '2CAL', '2A', '2B', '2C', '2P', '2D',
  '1R', '3', '2DR', 'corsi', 'dig', 'spd',
];

export const STAGE_META: Record<StageId, StageMeta> = {
  ctx: { id: 'ctx', session: 1, codeLabel: '·', title: 'Contexto', description: 'Código, sono, medicação', minutes: 2 },
  '1A': { id: '1A', session: 1, codeLabel: '1A', title: 'Fase 1A', description: 'Regras explícitas', minutes: 3 },
  '1B': { id: '1B', session: 1, codeLabel: '1B', title: 'Fase 1B', description: 'Lua e Sol', minutes: 4 },
  '2T': { id: '2T', session: 1, codeLabel: '2A', title: 'Fase 2A, treino', description: 'Símbolos extras e irrelevantes', minutes: 4 },
  '2CAL': { id: '2CAL', session: 1, codeLabel: '2A', title: 'Fase 2A, ajuste', description: 'Duração da pista em escada', minutes: 3 },
  '2A': { id: '2A', session: 1, codeLabel: '2A', title: 'Fase 2A', description: 'Generalização: carga × instrução', minutes: 6 },
  '2B': { id: '2B', session: 1, codeLabel: '2B', title: 'Fase 2B', description: 'Reassociação com símbolos novos', minutes: 6 },
  '2C': { id: '2C', session: 1, codeLabel: '2C', title: 'Fase 2C', description: 'Reversão de contingências', minutes: 5 },
  '2P': { id: '2P', session: 1, codeLabel: '2P', title: 'Fase 2P', description: 'Lua e Sol menos confiáveis', minutes: 7 },
  '2D': { id: '2D', session: 1, codeLabel: '2D', title: 'Fase 2D', description: 'Inferência sem pista, feedback ruidoso', minutes: 9 },
  '1R': { id: '1R', session: 2, codeLabel: '1A′', title: 'Reaquecimento', description: 'Um bloco da Fase 1A', minutes: 1 },
  '3': { id: '3', session: 2, codeLabel: '3', title: 'Fase 3', description: 'Blocking com 8 pistas', minutes: 10 },
  '2DR': { id: '2DR', session: 2, codeLabel: '2D′', title: 'Fase 2D, reteste', description: 'Outra sequência, mesma estrutura', minutes: 9 },
  corsi: { id: 'corsi', session: 2, codeLabel: 'WM', title: 'Blocos', description: 'Memória visuoespacial', minutes: 3 },
  dig: { id: 'dig', session: 2, codeLabel: 'WM', title: 'Dígitos inversos', description: 'Memória verbal', minutes: 3 },
  spd: { id: 'spd', session: 2, codeLabel: 'VP', title: 'Velocidade', description: 'Comparação de formas, 60 s', minutes: 1 },
};

export const CORSI_POSITIONS: Array<[number, number]> = [
  [12, 10], [45, 6], [76, 18],
  [8, 42], [38, 36], [70, 48],
  [20, 74], [52, 70], [80, 78],
];

export const PROTOCOL_CHANGES: Array<{ phase: string; summary: string }> = [
  {
    phase: 'Todas',
    summary: 'Três opções fixas (primeira, segunda, nova); acaso 1/3; escolher a segunda figura conta como lapso. Sequências fixas por forma A ou B. Igualdade definida só pela forma; cor e tamanho variam. Tempo limite de 6 s, com TR medido do início da sequência e das opções.',
  },
  {
    phase: '1A',
    summary: '18 de 20, com pelo menos 9 por regra, em até 6 blocos. Exemplos da instrução usam formas que não entram nas tentativas. Palavra visível durante a escolha.',
  },
  {
    phase: '1B',
    summary: '≥ 90% em dois blocos seguidos, ≥ 8/10 por regra, até 6 blocos. Teste explícito dos símbolos ao final, como medida descritiva. Quem não atinge o critério segue marcado.',
  },
  {
    phase: '2A',
    summary: 'Dez símbolos treinados, irrelevantes em validade de 50%. Sete posições fixas com marcadores neutros. Duração da pista em escada 2-para-baixo/1-para-cima. Nas tentativas explícitas, as pistas informativas somem e a palavra aparece. 80 tentativas, sem feedback.',
  },
  {
    phase: '2B',
    summary: '40 tentativas, extensão por blocos até o critério, teste com figuras inéditas, Lua e Sol em intervalo equivalente. Relatório destaca as primeiras tentativas e a inferência por exclusividade mútua.',
  },
  {
    phase: '2C',
    summary: '60 tentativas com duas reversões em janelas (17 a 25 e 39 a 47). Sondas de Losango e Estrela, sem feedback, depois da primeira reversão, para testar se a inversão se transfere.',
  },
  {
    phase: '2D',
    summary: 'h = 0,05 e q = 0,80, sequência com 6 trocas. Medida principal comparada ao observador ideal no mesmo feedback, por distância até a troca. Confiança estratificada pela distância até a troca.',
  },
  {
    phase: '3',
    summary: '8 pistas dentro do participante (X1→A, X2→B; X1Y1, X2Y2, W1V1, W2V2). Teste com escolha, nota de preditividade e reconhecimento.',
  },
];

export const PROTOCOL_VERSION = '1.0';
export const STORAGE_KEY = 'projeto-atencao-v1';

export function createFreshState(): AttentionState {
  return {
    v: PROTOCOL_VERSION,
    code: '',
    form: 'A',
    created: new Date().toISOString(),
    ctx: {},
    rows: [],
    done: {},
    res: {},
    ooo: {},
  };
}

export function getNextStage(state: AttentionState): StageId | undefined {
  return STAGE_ORDER.find((id) => !state.done[id]);
}
