import { AttentionState, RuleCode, StageId, TrialRow } from '../types/protocol';
import { formatMs, formatNum, formatPct, mean, median } from './rng';
import { MAP } from './stimuli';
import { make2D } from './trials';

export function bayesObserver(rows: TrialRow[], h = 0.05, q = 0.8): number[] {
  let b = 0.5;
  return rows.map((r) => {
    const p = b;
    const c: RuleCode | null = r.papel === 'F1' ? 'A' : r.papel === 'nova' ? 'B' : null;
    if (c && r.fb !== 'none') {
      const e = (c === 'A') === (r.fb === '+');
      const LA = e ? q : 1 - q;
      const LB = e ? 1 - q : q;
      b = (b * LA) / (b * LA + (1 - b) * LB);
    }
    b = (1 - h) * b + h * (1 - b);
    return p;
  });
}

export function wslsSim(z: RuleCode[], flips: boolean[]): number {
  let c: RuleCode = 'A';
  let ok = 0;
  z.forEach((zt, i) => {
    const cor = c === zt;
    if (cor) ok++;
    const fb = flips[i] ? !cor : cor;
    if (!fb) c = c === 'A' ? 'B' : 'A';
  });
  return ok / z.length;
}

const logit = (p: number) => Math.log(p / (1 - p));
const invLogit = (x: number) => 1 / (1 + Math.exp(-x));

export interface FittedModelResult {
  nome: string;
  k: number;
  ll: number;
  bic: number;
  par: string;
  h?: number;
}

export function fitModels(rows: TrialRow[]): { all: FittedModelResult[]; n: number; baye: FittedModelResult } | null {
  const D = rows.map((r) => ({
    c: r.papel === 'F1' ? 1 : r.papel === 'nova' ? 0 : null,
    fb: r.fb,
  }));
  const n = D.filter((d) => d.c !== null).length;
  if (n < 20) return null;

  const eps = [0, 0.02, 0.05, 0.1, 0.2, 0.3];
  const beta = [0.25, 0.5, 1, 2, 4, 8];
  const hz = [0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.18, 0.25, 0.35];
  const kap = [0, 0.5, 1, 2];

  let bestB = { ll: -Infinity, h: 0.05, B: 1, E: 0, K: 0 };
  for (const h of hz) {
    for (const B of beta) {
      for (const E of eps) {
        for (const K of kap) {
          let b = 0.5;
          let ll = 0;
          let prev = 0;
          for (const d of D) {
            if (d.c !== null) {
              const p0 = invLogit(B * logit(Math.min(0.999, Math.max(0.001, b))) + K * prev);
              const p = Math.max(1e-6, E / 2 + (1 - E) * p0);
              ll += Math.log(d.c ? p : Math.max(1e-6, 1 - p));
              if (d.fb !== 'none') {
                const e = Boolean(d.c) === (d.fb === '+');
                const LA = e ? 0.8 : 0.2;
                b = (b * LA) / (b * LA + (1 - b) * (1 - LA));
              }
              prev = d.c ? 1 : -1;
            }
            b = (1 - h) * b + h * (1 - b);
          }
          if (ll > bestB.ll) bestB = { ll, h, B, E, K };
        }
      }
    }
  }

  const baye: FittedModelResult = {
    nome: 'Bayesiano (h, β, ε, κ)',
    k: 4,
    ll: bestB.ll,
    bic: 4 * Math.log(n) - 2 * bestB.ll,
    par: `h = ${formatNum(bestB.h, 3)}, β = ${formatNum(bestB.B)}, ε = ${formatNum(bestB.E)}, κ = ${formatNum(bestB.K)}`,
    h: bestB.h,
  };

  let bestR = { ll: -Infinity, a: 0.1, B: 1, E: 0, K: 0 };
  const al = Array.from({ length: 20 }, (_, i) => 0.05 * (i + 1));
  const bb = [1, 2, 4, 8, 16, 32];
  for (const a of al) {
    for (const B of bb) {
      for (const E of eps) {
        for (const K of kap) {
          let v = 0.5;
          let ll = 0;
          let prev = 0;
          for (const d of D) {
            if (d.c === null) continue;
            const p0 = invLogit(B * (v - 0.5) + K * prev);
            const p = Math.max(1e-6, E / 2 + (1 - E) * p0);
            ll += Math.log(d.c ? p : Math.max(1e-6, 1 - p));
            if (d.fb !== 'none') {
              const tgt = Boolean(d.c) === (d.fb === '+') ? 1 : 0;
              v += a * (tgt - v);
            }
            prev = d.c ? 1 : -1;
          }
          if (ll > bestR.ll) bestR = { ll, a, B, E, K };
        }
      }
    }
  }

  const rw: FittedModelResult = {
    nome: 'Rescorla-Wagner (α, β, ε, κ)',
    k: 4,
    ll: bestR.ll,
    bic: 4 * Math.log(n) - 2 * bestR.ll,
    par: `α = ${formatNum(bestR.a)}, β = ${formatNum(bestR.B)}, ε = ${formatNum(bestR.E)}, κ = ${formatNum(bestR.K)}`,
  };

  const ws = [0, 0];
  const ls = [0, 0];
  let last: { c: number | null; fb?: string } | null = null;
  for (const d of D) {
    if (d.c === null) continue;
    if (last && last.fb !== 'none') {
      const stay = d.c === last.c;
      if (last.fb === '+') {
        ws[1]++;
        if (stay) ws[0]++;
      } else {
        ls[1]++;
        if (stay) ls[0]++;
      }
    }
    last = d;
  }
  const bin = (x: number, m: number) => {
    if (!m) return 0;
    const p = Math.min(0.999, Math.max(0.001, x / m));
    return x * Math.log(p) + (m - x) * Math.log(1 - p);
  };
  const llW = bin(ws[0], ws[1]) + bin(ls[0], ls[1]) + Math.log(0.5);
  const wsls: FittedModelResult = {
    nome: 'Ganha-fica/perde-troca',
    k: 2,
    ll: llW,
    bic: 2 * Math.log(n) - 2 * llW,
    par: `P(fica | ganhou) = ${formatNum(ws[0] / (ws[1] || 1))}, P(fica | perdeu) = ${formatNum(ls[0] / (ls[1] || 1))}`,
  };

  const all = [baye, rw, wsls].sort((a, b) => a.bic - b.bic);
  return { all, n, baye };
}

export function rowsOf(state: AttentionState, stage: StageId): TrialRow[] {
  return state.rows.filter((r) => r.stage === stage);
}

export function validRT(rows: TrialRow[]): number[] {
  return rows
    .filter((r) => r.tr !== null && r.tr !== undefined && r.tr >= 150 && r.acerto === 1)
    .map((r) => r.tr as number);
}

export interface Report2DData {
  rows: TrialRow[];
  beliefs: number[];
  acc: number;
  idealAcc: number;
  wslsAcc: number;
  agreement: number;
  f2Count: number;
  medianRt: number;
  labels: string[];
  meByLag: number[];
  idealByLag: number[];
  confByLag: number[];
  fit: ReturnType<typeof fitModels>;
}

export function compute2DReport(state: AttentionState, key: '2D' | '2DR'): Report2DData | null {
  const R = rowsOf(state, key).slice().sort((a, b) => a.n - b.n);
  if (R.length < 120) return null;
  const beliefs = bayesObserver(R);
  const idealOK = beliefs.map((b, i) => (b === 0.5 ? 0.5 : (b > 0.5 ? 'A' : 'B') === R[i].regra ? 1 : 0));
  const q = make2D(state.form, key);
  const wslsAcc = wslsSim(q.z, q.flips);
  const valid = R.filter((r) => !r.omissao);
  const acc = mean(R.map((r) => r.acerto || 0));

  const bins: Array<[number, number]> = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 6], [7, 1e9]];
  const labels = ['0', '1', '2', '3', '4–6', '7+'];

  const meByLag = bins.map(([a, b]) =>
    mean(R.filter((r) => Number(r.lag) >= a && Number(r.lag) <= b).map((r) => r.acerto || 0))
  );
  const idealByLag = bins.map(([a, b]) =>
    mean(idealOK.filter((_, i) => Number(R[i].lag) >= a && Number(R[i].lag) <= b))
  );
  const co = R.filter((r) => r.conf !== '' && r.conf !== undefined);
  const confByLag = bins.map(([a, b]) =>
    mean(co.filter((r) => Number(r.lag) >= a && Number(r.lag) <= b).map((r) => Number(r.conf)))
  );

  const agreement = mean(
    R.map((r, i) => {
      if ((r.papel !== 'F1' && r.papel !== 'nova') || beliefs[i] === 0.5) return NaN;
      return (r.papel === 'F1') === (beliefs[i] > 0.5) ? 1 : 0;
    }).filter((x) => !Number.isNaN(x))
  );

  return {
    rows: R,
    beliefs,
    acc,
    idealAcc: mean(idealOK),
    wslsAcc,
    agreement,
    f2Count: R.filter((r) => r.papel === 'F2').length,
    medianRt: median(valid.filter((r) => (r.tr || 0) >= 150).map((r) => r.tr as number)),
    labels,
    meByLag,
    idealByLag,
    confByLag,
    fit: fitModels(R),
  };
}

export function compute2CReport(state: AttentionState) {
  const all = rowsOf(state, '2C');
  if (!all.length) return null;
  const R = all.filter((r) => !r.sonda).slice().sort((a, b) => a.n - b.n);
  const res = state.res['2C'];
  if (!res) return null;
  const revs = [res.r1, res.r2];
  const lines = revs.map((r, ix) => {
    const end = ix === 0 ? res.r2 : 61;
    const seg = R.filter((x) => x.n >= r && x.n < end);
    let crit: number | null = null;
    let run = 0;
    for (let i = 0; i < seg.length; i++) {
      run = seg[i].acerto ? run + 1 : 0;
      if (run === 4) {
        crit = i + 1;
        break;
      }
    }
    const fe = seg.findIndex((x) => x.fb === '-');
    let inf = '–';
    if (fe >= 0) {
      const o = seg.slice(fe + 1).find((x) => x.pista !== seg[fe].pista);
      if (o) inf = o.acerto ? 'acertou' : 'errou';
    }
    let pN = 0;
    let pK = 0;
    seg.forEach((x, i) => {
      const pv = seg.slice(0, i).reverse().find((y) => y.pista === x.pista);
      if (pv && pv.fb === '-') {
        pN++;
        if (!x.acerto && x.papel !== 'F2') pK++;
      }
    });
    const rtA = median(R.filter((x) => x.n >= r - 8 && x.n < r && (x.tr || 0) >= 150).map((x) => x.tr as number));
    const rtB = median(R.filter((x) => x.n >= r && x.n < r + 8 && (x.tr || 0) >= 150).map((x) => x.tr as number));
    return [
      `${ix + 1}ª, na tentativa ${r}`,
      crit ? String(crit) : `mais de ${seg.length} (censurado)`,
      inf,
      pN ? `${pK}/${pN}` : '–',
      formatMs(rtA),
      formatMs(rtB),
    ];
  });

  const pr = all.filter((r) => r.sonda === 1);
  const invd = pr.filter((r) => r.papel === (r.regra === 'A' ? 'nova' : 'F1')).length;
  const stable = R.filter((x) => x.n < res.r1);
  return {
    lines,
    preRevError: formatPct(1 - mean(stable.map((x) => x.acerto || 0))),
    probesInverted: `${invd} de ${pr.length}`,
  };
}

export function compute2PReport(state: AttentionState) {
  const R = rowsOf(state, '2P').slice().sort((a, b) => a.n - b.n);
  if (!R.length) return null;
  const res = state.res['2P'] || { r1: 35, r2: 68 };
  const flip = (r: RuleCode): RuleCode => (r === 'A' ? 'B' : 'A');
  const mapped = (r: TrialRow): RuleCode =>
    r.segmento === 2 ? flip(MAP[r.pista || 'lua']) : MAP[r.pista || 'lua'];
  const ch = (r: TrialRow): RuleCode | null => (r.papel === 'F1' ? 'A' : r.papel === 'nova' ? 'B' : null);

  const stable = R.filter(
    (r) => ![1, res.r1, res.r2].some((s) => r.n >= s && r.n < s + 10) && ch(r)
  );
  const mx = mean(stable.map((r) => (ch(r) === mapped(r) ? 1 : 0)));

  let op = 0;
  let sw = 0;
  R.forEach((r, i) => {
    if (r.excecao !== 1 || !ch(r)) return;
    const j = R.slice(i + 1).find((x) => x.pista === r.pista);
    if (!j || j.segmento !== r.segmento || !ch(j)) return;
    op++;
    if (ch(j) !== mapped(j)) sw++;
  });

  const adapt = [res.r1, res.r2].map((s, k) => {
    const end = k ? 101 : res.r2;
    const seg = R.filter((r) => r.n >= s && r.n < end);
    let run = 0;
    for (let i = 0; i < seg.length; i++) {
      run = ch(seg[i]) === mapped(seg[i]) ? run + 1 : 0;
      if (run === 4) return String(i + 1);
    }
    return `mais de ${seg.length} (censurado)`;
  });

  return {
    acc: formatPct(mean(R.map((r) => r.acerto || 0)), 1),
    mostProbable: formatPct(mx),
    switchedAfterExc: op ? `${sw} de ${op}` : '–',
    adapt1: adapt[0],
    adapt2: adapt[1],
  };
}

export function compute2AReport(state: AttentionState) {
  const R = rowsOf(state, '2A');
  if (!R.length) return null;
  const labels: Record<string, string> = {
    C1: 'C1 · 1 informativa',
    C2: 'C2 · 3 informativas',
    C3: 'C3 · 1 + 4 irrelevantes',
    C4: 'C4 · 3 + 4 irrelevantes',
  };
  const rows = ['C1', 'C2', 'C3', 'C4'].map((c) => {
    const e = R.filter((r) => r.cond === c && r.instr === 'explicita');
    const n = R.filter((r) => r.cond === c && r.instr === 'inferida');
    const ae = mean(e.map((r) => r.acerto || 0));
    const an = mean(n.map((r) => r.acerto || 0));
    return [
      labels[c],
      formatPct(ae),
      formatPct(an),
      formatPct(ae - an),
      formatMs(median(validRT(e))),
      formatMs(median(validRT(n))),
    ];
  });
  const cal = state.res['2CAL'];
  const res2a = state.res['2A'];
  return {
    cueMs: res2a ? `${res2a.cueMs} ms` : '–',
    thr: cal?.thr ? `${cal.thr} ms` : '–',
    reversoes: cal?.reversoes ?? '–',
    lapsos: R.filter((r) => r.papel === 'F2').length,
    rows,
  };
}

export function compute2BReport(state: AttentionState) {
  const R = rowsOf(state, '2B');
  if (!R.length) return null;
  const L = R.filter((r) => !r.tipo).slice().sort((a, b) => a.bloco - b.bloco || a.n - b.n);
  const first10 = L.slice(0, 10);
  const a = L[0]?.pista;
  const o = L.find((r) => r.pista !== a);
  const T = (t: string) => R.filter((r) => r.tipo === t);
  const res = state.res['2B'];
  return {
    first10: formatPct(mean(first10.map((r) => r.acerto || 0))),
    secondCueFirst: o ? (o.acerto ? 'acertou' : 'errou') : '–',
    totalLearn: L.length,
    passed: res?.passed ? 'atingido' : 'não atingido',
    testNovel: formatPct(mean(T('teste_novas').map((r) => r.acerto || 0))),
    testOld: formatPct(mean(T('teste_antigas').map((r) => r.acerto || 0))),
  };
}

export function compute3Report(state: AttentionState) {
  const R = rowsOf(state, '3');
  if (!R.length) return null;
  const P = (k: string) => mean(R.filter((r) => r.tipo === `teste_${k}`).map((r) => r.acerto || 0));
  const not = (k: string) =>
    mean(
      R.filter((r) => r.tipo === 'nota' && (r.pista || '')[0] === k).map((r) =>
        r.regra === 'A' ? 4 - Number(r.resposta) : Number(r.resposta) - 4
      )
    );
  const rec = (k: string) =>
    mean(
      R.filter((r) => r.tipo === 'reconhecimento' && (r.pista || '')[0] === k).map((r) =>
        Number(r.resposta)
      )
    );
  const foil = mean(
    R.filter((r) => r.tipo === 'reconhecimento' && r.antigo === 0).map((r) => Number(r.resposta))
  );

  return {
    rows: [
      ['X (pré-treinada)', formatPct(P('X')), formatNum(not('X'), 1), formatPct(rec('X'))],
      ['Y (bloqueada)', formatPct(P('Y')), formatNum(not('Y'), 1), formatPct(rec('Y'))],
      ['W (composto controle)', formatPct(P('W')), formatNum(not('W'), 1), formatPct(rec('W'))],
      ['V (composto controle)', formatPct(P('V')), formatNum(not('V'), 1), formatPct(rec('V'))],
      ['Símbolos não apresentados', '–', '–', formatPct(foil)],
    ],
    biChoice: formatPct(P('V') - P('Y')),
    biRating: formatNum(not('V') - not('Y'), 1),
  };
}

export function computeLearnBlockReport(state: AttentionState, s: '1A' | '1B') {
  const R = rowsOf(state, s).filter((r) => r.pos !== undefined);
  if (!R.length) return null;
  const res = state.res[s];
  const lp = R.filter((r) => r.papel === 'F2').length;
  const om = R.filter((r) => r.omissao === 1).length;
  const er = (k: RuleCode) => R.filter((r) => r.regra === k && !r.acerto).length;
  const bl: Record<number, number[]> = {};
  R.forEach((r) => {
    (bl[r.bloco] = bl[r.bloco] || []).push(r.acerto || 0);
  });
  const checks = rowsOf(state, s).filter((r) => r.tipo === 'checagem');
  return {
    criterion: res?.passed ? `atingido em ${res.blocks} bloco(s)` : `não atingido (${res?.blocks || 0} blocos)`,
    trials: R.length,
    medianRt: formatMs(median(validRT(R))),
    errorsAB: `${er('A')} / ${er('B')}`,
    lapses: lp,
    omissions: om,
    blocks: Object.keys(bl).map((k) => {
      const arr = bl[Number(k)];
      return [k, `${arr.reduce((a, b) => a + b, 0)}/${arr.length}`];
    }),
    checks,
  };
}

export function toCSV(rows: TrialRow[]): string {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const q = (v: unknown) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return keys.join(',') + '\n' + rows.map((r) => keys.map((k) => q((r as unknown as Record<string, unknown>)[k])).join(',')).join('\n');
}
