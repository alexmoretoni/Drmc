import { FormCode, RuleCode, ShapeSetKey, TrialSpec } from '../types/protocol';
import { createRng, DeterministicRng, hashString } from './rng';
import { COL, CUES, IRR, SCL, SET } from './stimuli';

export function balRules(n: number, rng: DeterministicRng): RuleCode[] {
  const base: RuleCode[] = Array.from({ length: n }, (_, i) => (i % 2 ? 'B' : 'A'));
  let best = base;
  let bs = 1e9;
  for (let k = 0; k < 300; k++) {
    const x = rng.shuffle(base);
    let run = 1;
    let mx = 1;
    const tr: Record<string, number> = { AA: 0, AB: 0, BA: 0, BB: 0 };
    for (let i = 1; i < n; i++) {
      tr[x[i - 1] + x[i]]++;
      run = x[i] === x[i - 1] ? run + 1 : 1;
      mx = Math.max(mx, run);
    }
    if (mx > 4) continue;
    const vals = Object.values(tr);
    const s = Math.max(...vals) - Math.min(...vals);
    if (s < bs) {
      bs = s;
      best = x;
    }
  }
  return best;
}

export function createTrial(
  setN: ShapeSetKey,
  rng: DeterministicRng,
  rule: RuleCode,
  prev: TrialSpec | null,
  extra?: Partial<TrialSpec>
): TrialSpec {
  const st = SET[setN];
  let f: string[];
  let guard = 0;
  do {
    f = rng.shuffle(st).slice(0, 3);
  } while (prev && (f[0] === prev.f[0] || f[2] === prev.f[2]) && ++guard < 40);

  const c0 = rng.int(6);
  let c1 = rng.int(5);
  if (c1 >= c0) c1++;

  return Object.assign(
    {
      setN,
      rule,
      f: [f[0], f[1], f[2]] as [string, string, string],
      col: [
        COL[c0],
        COL[c1],
        rng.pick(COL),
        rng.pick(COL),
        rng.pick(COL),
      ] as [string, string, string, string, string],
      sc: [0, 0, 0, 0, 0].map(() => rng.pick(SCL)) as [number, number, number, number, number],
      order: rng.shuffle([0, 1, 2]) as [number, number, number],
      fb: true as boolean | 'q',
      cue: null,
    },
    extra || {}
  );
}

export function createSeries(
  setN: ShapeSetKey,
  rng: DeterministicRng,
  rules: RuleCode[],
  mk?: (r: RuleCode, i: number) => Partial<TrialSpec>
): TrialSpec[] {
  let prev: TrialSpec | null = null;
  return rules.map((r, i) => {
    const extra = mk ? mk(r, i) : {};
    prev = createTrial(setN, rng, r, prev, extra);
    return prev;
  });
}

export function slots7(rng: DeterministicRng, arr: string[]): Array<string | null> {
  const pos = rng.shuffle([0, 1, 2, 3, 4, 5, 6]);
  const s: Array<string | null> = Array(7).fill(null);
  arr.forEach((a, i) => {
    s[pos[i]] = a;
  });
  return s;
}

export function arrCue(
  rng: DeterministicRng,
  rule: RuleCode,
  nInf: number,
  nIrr: number,
  explicit: boolean
): { slots: Array<string | null>; inf: string[] } {
  const inf = nInf === 1 ? [rng.pick(CUES[rule])] : CUES[rule].slice();
  const irr = rng.shuffle(IRR).slice(0, nIrr);
  return {
    slots: slots7(rng, explicit ? irr : [...inf, ...irr]),
    inf,
  };
}

export function make2D(
  form: FormCode,
  key: string
): {
  z: RuleCode[];
  flips: boolean[];
  lag: number[];
  confSet: Set<number>;
  chg: number[];
} {
  const rng = createRng(hashString(`PA|${form}|${key}`));
  let z: RuleCode[] = [];
  let chg: number[] = [];

  for (;;) {
    z = [rng() < 0.5 ? 'A' : 'B'];
    const ch: number[] = [];
    for (let i = 1; i < 120; i++) {
      const s = rng() < 0.05;
      z.push(s ? (z[i - 1] === 'A' ? 'B' : 'A') : z[i - 1]);
      if (s) ch.push(i);
    }
    if (ch.length !== 6) continue;
    const nA = z.filter((x) => x === 'A').length;
    if (nA < 50 || nA > 70) continue;
    const bounds = [0, ...ch, 120];
    let ok = true;
    for (let i = 1; i < bounds.length; i++) {
      if (bounds[i] - bounds[i - 1] < 6) {
        ok = false;
        break;
      }
    }
    if (ok) {
      chg = ch;
      break;
    }
  }

  const flips: boolean[] = [];
  for (let b = 0; b < 4; b++) {
    flips.push(...rng.shuffle(Array.from({ length: 30 }, (_, i) => i < 6)));
  }

  const lag: number[] = [];
  let l = 99;
  for (let i = 0; i < 120; i++) {
    if (chg.includes(i)) l = 0;
    else if (l < 99) l++;
    lag.push(l);
  }

  const confSet = new Set<number>();
  chg.forEach((c) => {
    confSet.add(c + 1);
    confSet.add(c + 3);
  });
  const stable = rng
    .shuffle(Array.from({ length: 120 }, (_, i) => i).filter((i) => lag[i] >= 8 && i > 5))
    .slice(0, 12);
  stable.forEach((i) => confSet.add(i));

  return { z, flips, lag, confSet, chg };
}
