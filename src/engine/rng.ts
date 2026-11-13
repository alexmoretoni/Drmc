import { FormCode } from '../types/protocol';

export interface DeterministicRng {
  (): number;
  int: (n: number) => number;
  shuffle: <T>(arr: readonly T[]) => T[];
  pick: <T>(arr: readonly T[]) => T;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number): DeterministicRng {
  let a = seed >>> 0;
  const fn = (() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as DeterministicRng;

  fn.int = (n: number) => Math.floor(fn() * n);
  fn.shuffle = <T>(arr: readonly T[]) => {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = fn.int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  fn.pick = <T>(arr: readonly T[]) => arr[fn.int(arr.length)];
  return fn;
}

export function rngFor(form: FormCode, key: string): DeterministicRng {
  return createRng(hashString(`PA|${form}|${key}`));
}

export function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
}

export function median(arr: number[]): number {
  if (!arr.length) return NaN;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function formatPct(x: number, decimals = 0): string {
  return Number.isNaN(x) ? '–' : `${(100 * x).toFixed(decimals).replace('.', ',')}%`;
}

export function formatMs(x: number): string {
  return Number.isNaN(x) ? '–' : `${Math.round(x)} ms`;
}

export function formatNum(x: number, decimals = 2): string {
  return Number.isNaN(x) ? '–' : x.toFixed(decimals).replace('.', ',');
}
