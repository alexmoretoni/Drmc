import { RuleCode, ShapeSetKey } from '../types/protocol';

const pt = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
const pd = (p: Array<[number, number]>) =>
  'M' + p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L') + 'Z';
const polar = (f: (a: number) => number, n = 180) =>
  pd(
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2;
      return pt(f(a), a);
    })
  );
const reg = (n: number, r = 42) =>
  pd(Array.from({ length: n }, (_, i) => pt(r, -Math.PI / 2 + (i / n) * 2 * Math.PI)));
const star = (n: number, ri: number, r = 45) =>
  pd(
    Array.from({ length: 2 * n }, (_, i) =>
      pt(i % 2 ? ri : r, -Math.PI / 2 + (i / n) * Math.PI)
    )
  );
const flower = (n: number) => polar((a) => 32 + 11 * Math.cos(n * (a + Math.PI / 2)));
const gear = (n: number) =>
  polar((a) => (Math.cos(n * (a + Math.PI / 2)) > 0 ? 44 : 31), n * 30);
const pl = (...c: number[]) => {
  const p: Array<[number, number]> = [];
  for (let i = 0; i < c.length; i += 2) p.push([c[i], c[i + 1]]);
  return pd(p);
};

export const FORM: Record<string, string> = {
  circulo: 'M-38 0a38 38 0 1 0 76 0a38 38 0 1 0-76 0Z',
  quadrado: 'M-34-34H34V34H-34Z',
  triangulo: reg(3, 46),
  cruz: pl(-13, -40, 13, -40, 13, -13, 40, -13, 40, 13, 13, 13, 13, 40, -13, 40, -13, 13, -40, 13, -40, -13, -13, -13),
  hexagono: reg(6),
  semicirculo: 'M-42 16a42 42 0 0 1 84 0Z',
  pentagono: reg(5),
  letraT: pl(-40, -36, 40, -36, 40, -12, 12, -12, 12, 40, -12, 40, -12, -12, -40, -12),
  letraL: pl(-30, -40, -6, -40, -6, 16, 34, 16, 34, 40, -30, 40),
  elipse: 'M-44 0a44 24 0 1 0 88 0a44 24 0 1 0-88 0Z',
  trapezio: pl(-24, -30, 24, -30, 44, 30, -44, 30),
  seta: pl(-42, -14, 4, -14, 4, -36, 42, 0, 4, 36, 4, 14, -42, 14),
  coracao: 'M0 38C-50 6-40-34-16-34C-6-34 0-26 0-20C0-26 6-34 16-34C40-34 50 6 0 38Z',
  gota2: 'M0-44C20-16 32-2 32 14A32 32 0 0 1-32 14C-32-2-20-16 0-44Z',
  anel: 'M-40 0a40 40 0 1 0 80 0a40 40 0 1 0-80 0ZM-20 0a20 20 0 1 0 40 0a20 20 0 1 0-40 0Z',
  letraH: pl(-38, -38, -14, -38, -14, -12, 14, -12, 14, -38, 38, -38, 38, 38, 14, 38, 14, 12, -14, 12, -14, 38, -38, 38),
  divisa: pl(-40, -6, 0, -40, 40, -6, 40, 22, 0, -12, -40, 22),
  ampulheta: pl(-32, -40, 32, -40, 8, 0, 32, 40, -32, 40, -8, 0),
  flor3: flower(3),
  flor4: flower(4),
  flor5: flower(5),
  eng6: gear(6),
  letraU: pl(-36, -38, -12, -38, -12, 14, 12, 14, 12, -38, 36, -38, 36, 38, -36, 38),
  letraZ: pl(-38, -38, 38, -38, 38, -16, -6, 16, 38, 16, 38, 38, -38, 38, -38, 16, 6, -16, -38, -16),
  lente: 'M-44 0A52 52 0 0 1 44 0A52 52 0 0 1-44 0Z',
  paralelo: pl(-20, -30, 44, -30, 20, 30, -44, 30),
  pipa: pl(0, -44, 28, -14, 0, 44, -28, -14),
  letraE: pl(-34, -40, 34, -40, 34, -20, -12, -20, -12, -10, 22, -10, 22, 10, -12, 10, -12, 20, 34, 20, 34, 40, -34, 40),
  escada: pl(-40, 40, -40, 14, -14, 14, -14, -12, 12, -12, 12, -38, 40, -38, 40, 40),
  setor: 'M-36 36V-36A72 72 0 0 1 36 36Z',
  est4: star(4, 14),
  est6: star(6, 24),
  eng10: gear(10),
  flor6: flower(6),
  bolha1: polar((a) => 32 + 9 * Math.sin(2 * a + 0.6) + 7 * Math.sin(3 * a + 2)),
  bolha2: polar((a) => 32 + 11 * Math.sin(3 * a + 1) + 5 * Math.sin(5 * a)),
  arco: 'M-42 34A42 42 0 0 1 42 34H20A20 20 0 0 0-20 34Z',
  letraY: pl(-40, -40, -14, -40, 0, -14, 14, -40, 40, -40, 12, 8, 12, 40, -12, 40, -12, 8),
  gravata: pl(-40, -30, 0, -8, 40, -30, 40, 30, 0, 8, -40, 30),
  pacman: 'M0 0L30-30A42 42 0 1 0 30 30Z',
  oito: 'M-21-21a21 21 0 1 0 42 0a21 21 0 1 0-42 0ZM-21 21a21 21 0 1 0 42 0a21 21 0 1 0-42 0Z',
  fechadura: 'M0-42a24 24 0 0 1 14 43.5L26 40H-26L-14 1.5A24 24 0 0 1 0-42Z',
  barra: pl(-44, -11, 44, -11, 44, 11, -44, 11),
  halter: pl(-44, -22, -22, -22, -22, -7, 22, -7, 22, -22, 44, -22, 44, 22, 22, 22, 22, 7, -22, 7, -22, 22, -44, 22),
  gancho: pl(8, -40, 30, -40, 30, 40, -30, 40, -30, 8, -8, 8, -8, 18, 8, 18),
};

export const SET: Record<ShapeSetKey, string[]> = {
  O: ['circulo', 'quadrado', 'triangulo', 'cruz', 'hexagono', 'semicirculo'],
  T: ['pentagono', 'letraT', 'letraL', 'elipse', 'trapezio', 'seta'],
  B1: ['coracao', 'gota2', 'anel', 'letraH', 'divisa', 'ampulheta'],
  B2: ['flor3', 'flor4', 'flor5', 'eng6', 'letraU', 'letraZ'],
  C: ['lente', 'paralelo', 'pipa', 'letraE', 'escada', 'setor'],
  D: ['est4', 'est6', 'eng10', 'flor6', 'bolha1', 'bolha2'],
  P: ['arco', 'letraY', 'gravata', 'pacman', 'oito', 'fechadura'],
};

// Cores calibradas para alto contraste em fundo claro neutro (#F1F5F9 / #FFFFFF)
export const COL = ['#D95F5F', '#CE8323', '#6E9328', '#1C947C', '#2E78C2', '#7A5EC4'];
export const SCL = [0.78, 0.9, 1, 1.1];

const rays = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return `M${(12 + 6.5 * c).toFixed(1)} ${(12 + 6.5 * s).toFixed(1)}L${(12 + 9.5 * c).toFixed(1)} ${(12 + 9.5 * s).toFixed(1)}`;
}).join('');

export const IC: Record<string, string> = {
  lua: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
  sol: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0z' + rays,
  losango: 'M12 3l9 9-9 9-9-9z',
  estrela: 'M12 3l2.8 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.8l-5.7 2.9 1.1-6.4L2.8 9.8l6.4-.9z',
  nuvem: 'M7 18a4 4 0 0 1-.6-8a6 6 0 0 1 11.5 1.5A3.3 3.3 0 0 1 17.5 18z',
  raio: 'M13 2L5 14h6l-1 8 8-12h-6z',
  gota: 'M12 3c4 5 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11 8 8 12 3z',
  folha: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8',
  chave: 'M4 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM11 12l9-9M16 7l3 3',
  sino: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  peixe: 'M3 12c4-6 10-6 14 0-4 6-10 6-14 0zM17 12l4-4v8z',
  ancora: 'M10 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM12 7v14M5 13a7 8 0 0 0 14 0M8 11h8',
  casa: 'M4 11l8-7 8 7v9H4z',
  bandeira: 'M6 21V4h12l-3 4 3 4H6',
  taca: 'M7 3h10v5a5 5 0 0 1-10 0zM12 13v6M8 21h8',
  guarda: 'M3 12a9 9 0 0 1 18 0zM12 12v7a2 2 0 0 0 4 0',
  barco: 'M3 15h18l-3 5H6zM12 3v12M12 3l6 9h-6',
  arvore: 'M12 3l6 8h-3l4 6H5l4-6H6zM12 17v4',
  olho: 'M2 12c4-6 14-6 20 0-6 6-16 6-20 0zM9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0z',
  cogumelo: 'M4 12a8 8 0 0 1 16 0zM10 12v7a2 2 0 0 0 4 0v-7',
  cadeado: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  lampada: 'M9 17a6.5 6.5 0 1 1 6 0v2H9zM10 22h4',
  relogio: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM12 7v5l3 2',
  chapeu: 'M3 18h18M7 18V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10M7 14h10',
};

export const NOME: Record<string, string> = {
  lua: 'Lua',
  sol: 'Sol',
  losango: 'Losango',
  estrela: 'Estrela',
};

export const WORD: Record<RuleCode, string> = { A: 'REPETIÇÃO', B: 'EXCLUSÃO' };
export const RN: Record<RuleCode, string> = { A: 'Repetição', B: 'Exclusão' };
export const CUES: Record<RuleCode, string[]> = { A: ['lua', 'nuvem', 'raio'], B: ['sol', 'gota', 'folha'] };
export const IRR = ['chave', 'sino', 'peixe', 'ancora'];
export const P_SYM = [
  'casa', 'bandeira', 'taca', 'guarda', 'barco', 'arvore',
  'olho', 'cogumelo', 'cadeado', 'lampada', 'relogio', 'chapeu',
];
export const MAP: Record<string, RuleCode> = {
  lua: 'A', sol: 'B', nuvem: 'A', raio: 'A',
  gota: 'B', folha: 'B', losango: 'A', estrela: 'B',
};
