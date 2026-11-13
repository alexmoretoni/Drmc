export type FormCode = 'A' | 'B';
export type RuleCode = 'A' | 'B';

export type StageId =
  | 'ctx'
  | '1A'
  | '1B'
  | '2T'
  | '2CAL'
  | '2A'
  | '2B'
  | '2C'
  | '2P'
  | '2D'
  | '1R'
  | '3'
  | '2DR'
  | 'corsi'
  | 'dig'
  | 'spd';

export type ShapeSetKey = 'O' | 'T' | 'B1' | 'B2' | 'C' | 'D' | 'P';

export type CueSpec =
  | { kind: 'word'; rule: RuleCode }
  | { kind: 'sym'; syms: string[] }
  | { kind: 'arr'; slots: Array<string | null>; word?: RuleCode | null }
  | { kind: 'mask' };

export interface TrialSpec {
  n?: number;
  setN: ShapeSetKey;
  rule: RuleCode;
  f: [string, string, string];
  col: [string, string, string, string, string];
  sc: [number, number, number, number, number];
  order: [number, number, number];
  fb: boolean | 'q';
  cue: CueSpec | null;
  cueName?: string;
  cueMs?: number;
  cond?: string;
  instr?: string;
  flip?: boolean;
  lag?: number;
  conf?: boolean;
  seg?: number | '';
  probe?: boolean;
  exc?: boolean;
  tipo?: string;
  rev?: number | '';
}

export interface TrialRow {
  pid: string;
  forma: FormCode;
  stage: StageId;
  fora_de_ordem: 0 | 1;
  bloco: number;
  t_ms: number;
  t_wall: number;
  n: number;
  regra?: RuleCode;
  cond?: string;
  instr?: string;
  pista?: string;
  validade_q?: 0 | 1 | '';
  f1?: string;
  f2?: string;
  nova?: string;
  pos?: number | null;
  papel?: '' | 'F1' | 'F2' | 'nova';
  tr?: number | null;
  omissao?: 0 | 1;
  acerto?: 0 | 1;
  fb?: string;
  conf?: number | '';
  cue_ms?: number | '';
  segmento?: number | '';
  sonda?: 0 | 1;
  excecao?: 0 | 1 | '';
  lag?: number | '';
  tipo?: string;
  reversao?: number | '';
  resposta?: string | number;
  antigo?: 0 | 1;
  tamanho?: number;
}

export interface ContextData {
  code?: string;
  idade?: string;
  escolaridade?: string;
  sono?: string;
  subst?: string;
  med?: string;
  dx?: string;
  modo?: 'remoto' | 'consultorio';
  dispositivo?: string;
  consentimento?: string;
}

export interface StageResults {
  '1A'?: { blocks: number; passed: boolean };
  '1B'?: { blocks: number; passed: boolean };
  '2T'?: { blocks: number; passed: boolean };
  '2CAL'?: { thr: number; cueMs: number; reversoes: number };
  '2A'?: { cueMs: number };
  '2B'?: { ext: number; passed: boolean };
  '2C'?: { r1: number; r2: number };
  '2P'?: { r1: number; r2: number };
  '2D'?: { chg: number[] };
  '2DR'?: { chg: number[] };
  '3'?: { map: Record<string, string> };
  corsi?: { span: number };
  dig?: { span: number };
}

export interface AttentionState {
  v: string;
  code: string;
  form: FormCode;
  created: string;
  consent?: string;
  ctx: ContextData;
  rows: TrialRow[];
  done: Partial<Record<StageId, string>>;
  res: StageResults;
  ooo: Partial<Record<StageId, boolean>>;
}

export interface InvitePayload {
  i: string;
  f?: FormCode;
  a?: string[];
  e?: number;
  token: string;
}

export interface RemoteConfig {
  api: string;
  jwk: JsonWebKey;
  devToolsAvailable?: boolean;
  devAdminToken?: string | null;
}

export interface AutoRunConfig {
  enabled: boolean;
  accuracy: number;
  speed: number;
}
