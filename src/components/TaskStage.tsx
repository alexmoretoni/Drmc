import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, HelpCircle } from 'lucide-react';
import {
  AttentionState,
  AutoRunConfig,
  CueSpec,
  FormCode,
  InvitePayload,
  RemoteConfig,
  RuleCode,
  StageId,
  TrialRow,
  TrialSpec,
} from '../types/protocol';
import { createRng, hashString, mean, rngFor } from '../engine/rng';
import { COL, CUES, IRR, MAP, NOME, P_SYM, SCL, SET, WORD } from '../engine/stimuli';
import { CORSI_POSITIONS, STAGE_META, STAGE_ORDER } from '../engine/stages';
import { arrCue, balRules, createSeries, createTrial, make2D, slots7 } from '../engine/trials';
import { sendEncryptedEnvelope } from '../engine/crypto';
import { CueIcon, ExampleSequence, ShapeFigure, SymbolLegend } from './StimulusSvg';
import { QuickInstructionsModal } from './QuickInstructionsModal';

interface TaskStageProps {
  stageId: StageId;
  state: AttentionState;
  invite: InvitePayload | null;
  remoteConfig: RemoteConfig | null;
  autoRun: AutoRunConfig;
  onComplete: (nextState: AttentionState) => void;
  onAbort: (toastMsg: string) => void;
}

class AbortError extends Error {}

type ScreenState =
  | {
      kind: 'instruction';
      title: string;
      btnLabel: string;
      body: React.ReactNode;
    }
  | {
      kind: 'trial';
      hud: string;
      phase: 'fixation' | 'cueMask' | 'blank' | 'active' | 'confidence' | 'feedback' | 'iti';
      cue: CueSpec | null;
      trial: TrialSpec | null;
      selectedPos: number | null;
      feedbackText: string;
      feedbackTone: 'ok' | 'no' | 'ne';
      showConfidence: boolean;
    }
  | {
      kind: 'symbolCheck';
      symbol: string;
    }
  | {
      kind: 'rating';
      symbol: string;
    }
  | {
      kind: 'recognition';
      symbol: string;
    }
  | {
      kind: 'corsi';
      length: number;
      litIndex: number | null;
      status: string;
    }
  | {
      kind: 'digits';
      length: number;
      displayDigit: string;
      showKeypad: boolean;
      inputValue: string;
    }
  | {
      kind: 'speed';
      hud: string;
      shapeA: string | null;
      colorA: string;
      scaleA: number;
      shapeB: string | null;
      colorB: string;
      scaleB: number;
    }
  | {
      kind: 'saveError';
      message: string;
      onDownload: () => void;
    }
  | {
      kind: 'fatalError';
      message: string;
    };

interface PendingAsk {
  keys?: Record<string, string>;
  timeout?: number;
  timerId?: number;
  resolve: (res: { v: string | null; ts: number; timeout?: boolean; abort?: boolean }) => void;
}

export const TaskStage: React.FC<TaskStageProps> = ({
  stageId,
  state,
  invite,
  remoteConfig,
  autoRun,
  onComplete,
  onAbort,
}) => {
  const [screen, setScreen] = useState<ScreenState>({
    kind: 'instruction',
    title: STAGE_META[stageId].title,
    btnLabel: 'Continuar',
    body: null,
  });
  const [exitToast, setExitToast] = useState('');
  const [showQuickGuide, setShowQuickGuide] = useState(false);

  const showQuickGuideRef = useRef(false);
  useEffect(() => {
    showQuickGuideRef.current = showQuickGuide;
  }, [showQuickGuide]);

  const abortRef = useRef(false);
  const escTimeRef = useRef(0);
  const pendingRef = useRef<PendingAsk | null>(null);
  const submissionRef = useRef(
    Date.now().toString(36) + Math.random().toString(36).slice(2)
  );
  const blockRef = useRef(0);
  const chunkCounterRef = useRef(0);
  const rowsRef = useRef<TrialRow[]>([]);
  const resRef = useRef({ ...state.res });
  const speedFactor = autoRun.enabled ? Math.max(1, autoRun.speed) : 1;
  const isRemote = Boolean(invite && remoteConfig);

  const checkAbort = useCallback(() => {
    if (abortRef.current) throw new AbortError();
  }, []);

  const waitMs = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms / speedFactor);
        if (abortRef.current) {
          window.clearTimeout(id);
          resolve();
        }
      }),
    [speedFactor]
  );

  const nextFrame = useCallback(
    () =>
      new Promise<number>((resolve) => {
        let done = false;
        const fin = (ts?: number) => {
          if (!done) {
            done = true;
            resolve(typeof ts === 'number' ? ts : performance.now());
          }
        };
        requestAnimationFrame(fin);
        window.setTimeout(() => fin(), 60);
      }),
    []
  );

  const resolveAsk = useCallback(
    (res: { v: string | null; ts: number; timeout?: boolean; abort?: boolean }) => {
      const p = pendingRef.current;
      if (!p) return;
      if (p.timerId !== undefined) window.clearTimeout(p.timerId);
      pendingRef.current = null;
      p.resolve(res);
    },
    []
  );

  const ask = useCallback(
    (opts: {
      keys?: Record<string, string>;
      timeout?: number;
      autoValue?: () => string;
    }) =>
      new Promise<{ v: string | null; ts: number; timeout?: boolean; abort?: boolean }>((resolve) => {
        const p: PendingAsk = {
          keys: opts.keys,
          timeout: opts.timeout,
          resolve,
        };
        pendingRef.current = p;

        if (opts.timeout) {
          p.timerId = window.setTimeout(() => {
            if (pendingRef.current === p) {
              resolveAsk({ v: null, ts: performance.now(), timeout: true });
            }
          }, opts.timeout / speedFactor);
        }

        if (autoRun.enabled && opts.autoValue) {
          const val = opts.autoValue();
          window.setTimeout(() => {
            if (pendingRef.current === p) {
              resolveAsk({ v: val, ts: performance.now() });
            }
          }, 1);
        }
      }),
    [autoRun.enabled, resolveAsk, speedFactor]
  );

  const sendPartial = useCallback(
    async (reason: string, keepalive = false) => {
      if (!isRemote || !invite || !remoteConfig || rowsRef.current.length === 0) return;
      try {
        await sendEncryptedEnvelope(
          remoteConfig,
          invite.token,
          'partial',
          {
            stage: stageId,
            submission: submissionRef.current,
            reason,
            rows: rowsRef.current,
          } as unknown as { submission: string; rows: TrialRow[] },
          keepalive
        );
      } catch {
        // Falhas em parciais nunca interrompem a tarefa
      }
    },
    [invite, isRemote, remoteConfig, stageId]
  );

  const tryExit = useCallback(() => {
    const now = Date.now();
    if (now - escTimeRef.current < 2200) {
      abortRef.current = true;
      resolveAsk({ v: null, ts: performance.now(), abort: true });
    } else {
      escTimeRef.current = now;
      setExitToast('Repita para sair. Os dados desta fase serão descartados.');
      window.setTimeout(() => setExitToast(''), 2200);
    }
  }, [resolveAsk]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showQuickGuideRef.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        tryExit();
        return;
      }
      const p = pendingRef.current;
      if (p && !e.repeat && p.keys && e.key in p.keys) {
        e.preventDefault();
        resolveAsk({ v: p.keys[e.key], ts: e.timeStamp });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resolveAsk, tryExit]);

  useEffect(() => {
    if (!isRemote) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        void sendPartial('pagina_fechada', true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isRemote, sendPartial]);

  useEffect(() => {
    abortRef.current = false;
    rowsRef.current = [];
    resRef.current = { ...state.res };
    blockRef.current = 0;
    chunkCounterRef.current = 0;

    const form: FormCode = state.form;
    const logRow = (o: Partial<TrialRow>) => {
      const row: TrialRow = {
        pid: state.code,
        forma: form,
        stage: stageId,
        fora_de_ordem: state.ooo[stageId] ? 1 : 0,
        bloco: blockRef.current,
        t_ms: Math.round(performance.now()),
        t_wall: Math.round(performance.timeOrigin + performance.now()),
        n: 0,
        ...o,
      };
      rowsRef.current.push(row);
      if (isRemote && ++chunkCounterRef.current >= 10) {
        chunkCounterRef.current = 0;
        void sendPartial('em_andamento', false);
      }
    };

    const showInstr = async (title: string, body: React.ReactNode, btnLabel = 'Continuar') => {
      checkAbort();
      window.scrollTo(0, 0);
      setScreen({ kind: 'instruction', title, body, btnLabel });
      const r = await ask({
        keys: { Enter: 'go', ' ': 'go' },
        autoValue: () => 'go',
      });
      if (r.abort) checkAbort();
      checkAbort();
    };

    const autoChoice = (t: TrialSpec) => {
      const good = t.order.indexOf(t.rule === 'A' ? 0 : 2);
      return String(
        Math.random() < autoRun.accuracy
          ? good
          : (good + 1 + Math.floor(Math.random() * 2)) % 3
      );
    };

    const runTrial = async (t: TrialSpec, hudLabel: string) => {
      checkAbort();
      setScreen({
        kind: 'trial',
        hud: hudLabel,
        phase: 'fixation',
        cue: null,
        trial: null,
        selectedPos: null,
        feedbackText: '',
        feedbackTone: 'ne',
        showConfidence: false,
      });
      await waitMs(400);
      checkAbort();

      if (t.cue && t.cue.kind === 'arr' && t.cueMs) {
        setScreen((prev) =>
          prev.kind === 'trial' ? { ...prev, phase: 'cueMask', cue: t.cue } : prev
        );
        await waitMs(t.cueMs);
        checkAbort();
        setScreen((prev) =>
          prev.kind === 'trial'
            ? { ...prev, phase: 'cueMask', cue: { kind: 'mask' } }
            : prev
        );
        await waitMs(100);
        checkAbort();
        setScreen((prev) =>
          prev.kind === 'trial' ? { ...prev, phase: 'blank', cue: null } : prev
        );
        await waitMs(150);
        checkAbort();
      }

      setScreen({
        kind: 'trial',
        hud: hudLabel,
        phase: 'active',
        cue: t.cue && t.cue.kind === 'arr' && t.cueMs ? null : t.cue,
        trial: t,
        selectedPos: null,
        feedbackText: '',
        feedbackTone: 'ne',
        showConfidence: false,
      });

      const t0 = await nextFrame();
      const r = await ask({
        keys: { '1': '0', '2': '1', '3': '2' },
        timeout: 6000,
        autoValue: () => autoChoice(t),
      });
      if (r.abort) checkAbort();

      const pos = r.timeout || r.v === null ? null : Number(r.v);
      let rt = r.timeout ? null : Math.round(Math.max(r.ts, t0) - t0);
      if (rt !== null && rt <= 0) rt = Math.round(performance.now() - t0);
      const role = pos === null ? null : t.order[pos];
      const corr = role === (t.rule === 'A' ? 0 : 2);

      let conf: number | null = null;
      if (t.conf && pos !== null) {
        setScreen((prev) =>
          prev.kind === 'trial'
            ? { ...prev, phase: 'confidence', selectedPos: pos, showConfidence: true }
            : prev
        );
        const c = await ask({
          keys: { '1': '1', '2': '2', '3': '3', '4': '4' },
          autoValue: () => '3',
        });
        if (c.abort) checkAbort();
        conf = Number(c.v);
      }

      let shown = 'none';
      if (pos === null) {
        setScreen((prev) =>
          prev.kind === 'trial'
            ? {
                ...prev,
                phase: 'feedback',
                selectedPos: null,
                showConfidence: false,
                feedbackText: 'Muito lento',
                feedbackTone: 'ne',
              }
            : prev
        );
        await waitMs(900);
      } else if (t.fb) {
        const val = t.fb === 'q' && t.flip ? !corr : corr;
        shown = val ? '+' : '-';
        setScreen((prev) =>
          prev.kind === 'trial'
            ? {
                ...prev,
                phase: 'feedback',
                selectedPos: pos,
                showConfidence: false,
                feedbackText: val ? 'Correto' : 'Incorreto',
                feedbackTone: val ? 'ok' : 'no',
              }
            : prev
        );
        await waitMs(750);
      } else {
        setScreen((prev) =>
          prev.kind === 'trial'
            ? {
                ...prev,
                phase: 'feedback',
                selectedPos: pos,
                showConfidence: false,
                feedbackText: '',
                feedbackTone: 'ne',
              }
            : prev
        );
        await waitMs(350);
      }

      logRow({
        n: t.n || 0,
        regra: t.rule,
        cond: t.cond || '',
        instr: t.instr || '',
        pista: t.cueName || '',
        validade_q: t.fb === 'q' ? (t.flip ? 0 : 1) : '',
        f1: t.f[0],
        f2: t.f[1],
        nova: t.f[2],
        pos,
        papel: role === null ? '' : (['F1', 'F2', 'nova'][role] as 'F1' | 'F2' | 'nova'),
        tr: rt,
        omissao: pos === null ? 1 : 0,
        acerto: corr ? 1 : 0,
        fb: shown,
        conf: conf === null ? '' : conf,
        cue_ms: t.cueMs || '',
        segmento: t.seg || '',
        sonda: t.probe ? 1 : 0,
        excecao: t.exc === undefined ? '' : t.exc ? 1 : 0,
        lag: t.lag === undefined ? '' : t.lag,
        tipo: t.tipo || '',
        reversao: t.rev || '',
      });

      setScreen((prev) =>
        prev.kind === 'trial'
          ? { ...prev, phase: 'iti', cue: null, trial: null, feedbackText: '' }
          : prev
      );
      await waitMs(250);
      checkAbort();
      return { corr, rule: t.rule, role, rt, shown };
    };

    const runList = async (list: TrialSpec[], label: string) => {
      let c = 0;
      const by: Record<RuleCode, [number, number]> = { A: [0, 0], B: [0, 0] };
      for (let i = 0; i < list.length; i++) {
        list[i].n = list[i].n || i + 1;
        const r = await runTrial(list[i], `${label} · ${i + 1}/${list.length}`);
        if (r.corr) c++;
        by[r.rule][0] += r.corr ? 1 : 0;
        by[r.rule][1]++;
      }
      return { c, n: list.length, by };
    };

    const executeStage = async () => {
      try {
        if (stageId === '1A') {
          await showInstr(
            'Fase 1A: as duas regras',
            <div className="space-y-4">
              <p>
                Você verá duas figuras em sequência e escolherá a terceira entre três opções: a primeira figura, a segunda figura e uma figura nova.
              </p>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-blue-700">Repetição</h3>
                <p className="text-sm text-slate-600">A terceira figura é igual à primeira.</p>
                <ExampleSequence goodIndex={0} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-blue-700">Exclusão</h3>
                <p className="text-sm text-slate-600">A terceira figura é diferente das duas primeiras.</p>
                <ExampleSequence goodIndex={2} />
              </div>
              <p>
                Igual significa ter a mesma forma. Cor e tamanho variam e não contam. Nesta fase o nome da regra aparece na tela. Responda com as teclas <strong>1, 2, 3</strong> ou tocando na opção. Você tem até 6 segundos e recebe feedback a cada resposta.
              </p>
            </div>,
            'Começar'
          );

          let b = 0;
          let ok = false;
          while (b < 6 && !ok) {
            b++;
            blockRef.current = b;
            const rng = rngFor(form, `1A-${b}`);
            const list = createSeries('O', rng, balRules(20, rng), (r) => ({
              cue: { kind: 'word', rule: r },
            }));
            const s = await runList(list, `Fase 1A · bloco ${b}`);
            ok = s.c >= 18 && s.by.A[0] >= 9 && s.by.B[0] >= 9;
            await showInstr(
              `Bloco ${b}: ${s.c} de 20`,
              <p className="text-slate-600">
                Repetição {s.by.A[0]}/10 · Exclusão {s.by.B[0]}/10. Critério: 18 de 20, com pelo menos 9 em cada regra.
              </p>,
              ok || b >= 6 ? 'Concluir' : 'Próximo bloco'
            );
          }
          resRef.current['1A'] = { blocks: b, passed: ok };
        } else if (stageId === '1B') {
          await showInstr(
            'Fase 1B: símbolos no lugar das palavras',
            <div className="space-y-4">
              <SymbolLegend left="lua" right="sol" />
              <p>
                Agora o nome da regra sai. Cada símbolo indica uma das duas regras, sempre a mesma. Descubra qual pelo feedback.
              </p>
            </div>,
            'Começar'
          );
          let b = 0;
          let streak = 0;
          while (b < 6 && streak < 2) {
            b++;
            blockRef.current = b;
            const rng = rngFor(form, `1B-${b}`);
            const rules = balRules(20, rng);
            const list = createSeries('O', rng, rules, (r) => {
              const cueName = r === 'A' ? 'lua' : 'sol';
              return { cue: { kind: 'sym', syms: [cueName] }, cueName };
            });
            const s = await runList(list, `Fase 1B · bloco ${b}`);
            const good = s.c >= 18 && s.by.A[0] >= 8 && s.by.B[0] >= 8;
            streak = good ? streak + 1 : 0;
            await showInstr(
              `Bloco ${b}: ${s.c} de 20`,
              <p className="text-slate-600">
                Critério: pelo menos 18 de 20, com ao menos 8 em cada regra, em dois blocos seguidos.
              </p>,
              streak >= 2 || b >= 6 ? 'Concluir' : 'Próximo bloco'
            );
          }

          for (const sym of ['lua', 'sol']) {
            blockRef.current = 0;
            checkAbort();
            setScreen({ kind: 'symbolCheck', symbol: sym });
            const r = await ask({
              keys: { '1': 'A', '2': 'B' },
              autoValue: () => MAP[sym],
            });
            if (r.abort) checkAbort();
            logRow({
              n: 0,
              tipo: 'checagem',
              pista: sym,
              regra: MAP[sym],
              resposta: r.v || '',
              acerto: r.v === MAP[sym] ? 1 : 0,
            });
          }
          resRef.current['1B'] = { blocks: b, passed: streak >= 2 };
        } else if (stageId === '2T') {
          await showInstr(
            'Fase 2A, treino: novos símbolos',
            <div className="space-y-3">
              <p>
                Vários símbolos aparecem agora em uma fileira de sete lugares. Alguns indicam a regra e outros não indicam nada. Descubra quais pelo feedback.
              </p>
              <p>Lua e Sol continuam indicando o mesmo de antes.</p>
            </div>,
            'Começar'
          );
          let b = 0;
          let ok = false;
          while (b < 4 && !ok) {
            b++;
            blockRef.current = b;
            const rng = rngFor(form, `2T-${b}`);
            const inf = [...CUES.A, ...CUES.B].flatMap((x) => [x, x, x, x]);
            const irrA = rng.shuffle(IRR.flatMap((x) => [x, x]));
            const irrB = rng.shuffle(IRR.flatMap((x) => [x, x]));
            const tr = rng.shuffle(inf).map((c) => ({ c, r: MAP[c] }));
            let ia = 0;
            let ib = 0;
            const noIrr = new Set(rng.shuffle(Array.from({ length: 24 }, (_, k) => k)).slice(0, 8));
            let prev: TrialSpec | null = null;
            const list = tr.map((x, i) => {
              let ir: string | null = null;
              if (!noIrr.has(i)) {
                if (x.r === 'A' && ia < irrA.length) ir = irrA[ia++];
                else if (x.r === 'B' && ib < irrB.length) ir = irrB[ib++];
              }
              const sl = slots7(rng, ir ? [x.c, ir] : [x.c]);
              prev = createTrial('O', rng, x.r, prev, {
                cue: { kind: 'arr', slots: sl },
                cueName: x.c + (ir ? `+${ir}` : ''),
              });
              return prev;
            });
            const s = await runList(list, `Treino de símbolos · bloco ${b}`);
            ok = s.c >= 21;
            await showInstr(
              `Bloco ${b}: ${s.c} de 24`,
              <p className="text-slate-600">Critério: pelo menos 21 de 24.</p>,
              ok || b >= 4 ? 'Concluir' : 'Próximo bloco'
            );
          }
          resRef.current['2T'] = { blocks: b, passed: ok };
        } else if (stageId === '2CAL') {
          await showInstr(
            'Fase 2A, ajuste de velocidade',
            <div className="space-y-3">
              <p>
                Agora os símbolos aparecem por um instante e somem antes das figuras. O tempo de exibição se ajusta ao seu desempenho, então a tarefa fica difícil de propósito.
              </p>
              <p>Não há feedback nesta parte. Responda como conseguir.</p>
            </div>,
            'Começar'
          );
          blockRef.current = 1;
          const rng = rngFor(form, '2CAL');
          const rules = balRules(40, rng);
          let D = 800;
          let st = 0;
          let dir = 0;
          const rev: number[] = [];
          let prev: TrialSpec | null = null;
          for (let i = 0; i < 40; i++) {
            const a = arrCue(rng, rules[i], 1, 4, false);
            prev = createTrial('T', rng, rules[i], prev, {
              n: i + 1,
              cue: { kind: 'arr', slots: a.slots },
              cueMs: Math.round(D),
              fb: false,
              cueName: a.inf.join('+'),
              cond: 'C3',
              instr: 'inferida',
            });
            const r = await runTrial(prev, `Ajuste · ${i + 1}/40`);
            if (r.corr) {
              st++;
              if (st === 2) {
                st = 0;
                if (dir === 1) rev.push(D);
                dir = -1;
                D = Math.max(50, D / 1.22);
              }
            } else {
              st = 0;
              if (dir === -1) rev.push(D);
              dir = 1;
              D = Math.min(2000, D * 1.22);
            }
          }
          const last = rev.slice(-6);
          const thr = last.length >= 2 ? Math.exp(mean(last.map(Math.log))) : D;
          resRef.current['2CAL'] = {
            thr: Math.round(thr),
            cueMs: Math.round(Math.min(1500, Math.max(100, thr))),
            reversoes: rev.length,
          };
        } else if (stageId === '2A') {
          const cueMs = resRef.current['2CAL']?.cueMs || 500;
          await showInstr(
            'Fase 2A: teste com figuras inéditas',
            <div className="space-y-3">
              <p>As figuras agora são novas. As regras e os símbolos são os mesmos, e não há feedback.</p>
              <p>
                Em metade das tentativas a palavra da regra aparece no lugar dos símbolos que a indicam. Na outra metade, use os símbolos.
              </p>
              <p className="text-xs font-mono text-slate-500">
                Tempo de exibição calibrado: {cueMs} ms.
              </p>
            </div>,
            'Começar'
          );
          const rng = rngFor(form, '2A');
          const C: Record<string, [number, number]> = { C1: [1, 0], C2: [3, 0], C3: [1, 4], C4: [3, 4] };
          let cells: Array<{ c: string; ins: string; r: RuleCode }> = [];
          for (const c in C) {
            for (const ins of ['explicita', 'inferida']) {
              for (const r of ['A', 'B'] as const) {
                for (let k = 0; k < 5; k++) cells.push({ c, ins, r });
              }
            }
          }
          cells = rng.shuffle(cells);
          let prev: TrialSpec | null = null;
          const list = cells.map((x) => {
            const [nI, nR] = C[x.c];
            const exp = x.ins === 'explicita';
            const a = arrCue(rng, x.r, nI, nR, exp);
            prev = createTrial('T', rng, x.r, prev, {
              cue: { kind: 'arr', slots: a.slots, word: exp ? x.r : null },
              cueMs,
              fb: false,
              cond: x.c,
              instr: x.ins,
              cueName: exp ? '' : a.inf.join('+'),
            });
            return prev;
          });
          blockRef.current = 1;
          await runList(list.slice(0, 40), 'Fase 2A · bloco 1');
          await showInstr('Pausa', <p className="text-slate-600">Descanse o quanto quiser.</p>, 'Continuar');
          blockRef.current = 2;
          const l2 = list.slice(40);
          l2.forEach((t, i) => {
            t.n = 41 + i;
          });
          await runList(l2, 'Fase 2A · bloco 2');
          resRef.current['2A'] = { cueMs };
        } else if (stageId === '2B') {
          await showInstr(
            'Fase 2B: dois símbolos novos',
            <div className="space-y-4">
              <SymbolLegend left="losango" right="estrela" />
              <p>
                Cada um destes símbolos indica uma das duas regras. Descubra qual pelo feedback.
              </p>
            </div>,
            'Começar'
          );
          const cueT = (c: string) => ({ cue: { kind: 'sym', syms: [c] } as CueSpec, cueName: c });
          const pick = (r: RuleCode) => (r === 'A' ? 'losango' : 'estrela');

          blockRef.current = 1;
          let rng = rngFor(form, '2B-L');
          let list = createSeries('B1', rng, balRules(40, rng), (r) => cueT(pick(r)));
          let s = await runList(list, 'Fase 2B · aprendizagem');
          let ext = 0;
          let lastOk =
            rowsRef.current
              .filter((r) => r.stage === '2B')
              .slice(-20)
              .reduce((a, r) => a + (r.acerto || 0), 0) >= 18;
          while (!lastOk && ext < 3) {
            ext++;
            blockRef.current = 1 + ext;
            rng = rngFor(form, `2B-X${ext}`);
            list = createSeries('B1', rng, balRules(20, rng), (r) => cueT(pick(r)));
            s = await runList(list, `Fase 2B · extensão ${ext}`);
            lastOk = s.c >= 18;
          }

          await showInstr(
            'Agora sem feedback',
            <p className="text-slate-600">Mesmos símbolos, figuras novas. Você não saberá se acertou.</p>,
            'Continuar'
          );
          blockRef.current = 10;
          rng = rngFor(form, '2B-T');
          list = createSeries('B2', rng, balRules(20, rng), (r) => ({
            ...cueT(pick(r)),
            fb: false,
            tipo: 'teste_novas',
          }));
          await runList(list, 'Fase 2B · teste');

          await showInstr(
            'Símbolos anteriores',
            <p className="text-slate-600">Lua e Sol voltam, também sem feedback.</p>,
            'Continuar'
          );
          blockRef.current = 11;
          rng = rngFor(form, '2B-O');
          list = createSeries('B2', rng, balRules(20, rng), (r) => ({
            ...cueT(r === 'A' ? 'lua' : 'sol'),
            fb: false,
            tipo: 'teste_antigas',
          }));
          await runList(list, 'Fase 2B · teste');
          resRef.current['2B'] = { ext, passed: lastOk };
        } else if (stageId === '2C') {
          await showInstr(
            'Fase 2C: Lua e Sol com feedback',
            <div className="space-y-4">
              <SymbolLegend left="lua" right="sol" />
              <p>
                Você volta a receber feedback nas tentativas com Lua e Sol. Em algumas tentativas aparece outro símbolo já visto, e nelas não há feedback.
              </p>
            </div>,
            'Começar'
          );
          blockRef.current = 1;
          const rng = rngFor(form, '2R');
          const r1 = 17 + rng.int(9);
          const r2 = 39 + rng.int(9);
          const cues = (() => {
            for (;;) {
              const x = rng.shuffle(Array.from({ length: 60 }, (_, i) => (i % 2 ? 'sol' : 'lua')));
              let ok = true;
              for (let i = 3; i < 60; i++) {
                if (x[i] === x[i - 1] && x[i] === x[i - 2] && x[i] === x[i - 3]) {
                  ok = false;
                  break;
                }
              }
              if (ok) return x;
            }
          })();
          const slotsP = rng
            .shuffle(Array.from({ length: r2 - 1 - (r1 + 8) + 1 }, (_, i) => r1 + 8 + i))
            .slice(0, 6);
          const probes = rng.shuffle(['losango', 'losango', 'losango', 'estrela', 'estrela', 'estrela']);
          let prev: TrialSpec | null = null;
          const list: TrialSpec[] = [];
          cues.forEach((c, i) => {
            const n = i + 1;
            const inv = n >= r1 && n < r2;
            const rule: RuleCode = inv ? (MAP[c] === 'A' ? 'B' : 'A') : MAP[c];
            prev = createTrial('C', rng, rule, prev, {
              n,
              cue: { kind: 'sym', syms: [c] },
              cueName: c,
              seg: n < r1 ? 1 : n < r2 ? 2 : 3,
              rev: n === r1 ? 1 : n === r2 ? 2 : '',
            });
            list.push(prev);
            const k = slotsP.indexOf(n);
            if (k >= 0) {
              const pc = probes[k];
              prev = createTrial('C', rng, MAP[pc], prev, {
                n: n + 0.5,
                cue: { kind: 'sym', syms: [pc] },
                cueName: pc,
                fb: false,
                probe: true,
                seg: 2,
              });
              list.push(prev);
            }
          });
          await runList(list, 'Fase 2C');
          resRef.current['2C'] = { r1, r2 };
        } else if (stageId === '2P') {
          await showInstr(
            'Fase 2P: Lua e Sol menos confiáveis',
            <div className="space-y-4">
              <SymbolLegend left="lua" right="sol" />
              <p>
                Lua e Sol continuam indicando as regras, mas agora <strong>nem sempre acertam</strong>: na maior parte das tentativas vale a regra do símbolo; em algumas, vale a outra.
              </p>
              <p>O feedback está sempre certo. Use-o para decidir o que fazer nas próximas vezes.</p>
            </div>,
            'Começar'
          );
          blockRef.current = 1;
          const rng = rngFor(form, '2P');
          const N = 100;
          const r1 = 34 + rng.int(5);
          const r2 = 67 + rng.int(5);
          const seg = (n: number) => (n < r1 ? 1 : n < r2 ? 2 : 3);
          const flip = (r: RuleCode): RuleCode => (r === 'A' ? 'B' : 'A');
          const cues = (() => {
            for (;;) {
              const x = rng.shuffle(Array.from({ length: N }, (_, i) => (i % 2 ? 'sol' : 'lua')));
              let ok = true;
              for (let i = 3; i < N; i++) {
                if (x[i] === x[i - 1] && x[i] === x[i - 2] && x[i] === x[i - 3]) {
                  ok = false;
                  break;
                }
              }
              if (ok) return x;
            }
          })();
          const exc = new Set<number>();
          for (const sg of [1, 2, 3]) {
            for (const c of ['lua', 'sol']) {
              const idx = cues.map((_, i) => i).filter((i) => cues[i] === c && seg(i + 1) === sg);
              const k = Math.round(idx.length * 0.2);
              for (let tries = 0; tries < 200; tries++) {
                const pick = new Set<number>();
                for (const j of rng.shuffle(idx.slice(2).map((_, q) => q + 2))) {
                  if (pick.size >= k) break;
                  if (pick.has(j - 1) || pick.has(j + 1)) continue;
                  pick.add(j);
                }
                if (pick.size === k) {
                  pick.forEach((j) => exc.add(idx[j]));
                  break;
                }
              }
            }
          }
          let prev: TrialSpec | null = null;
          const list = cues.map((c, i) => {
            const n = i + 1;
            const mapped = seg(n) === 2 ? flip(MAP[c]) : MAP[c];
            const e = exc.has(i);
            prev = createTrial('C', rng, e ? flip(mapped) : mapped, prev, {
              n,
              cue: { kind: 'sym', syms: [c] },
              cueName: c,
              seg: seg(n),
              rev: n === r1 ? 1 : n === r2 ? 2 : '',
              exc: e,
            });
            return prev;
          });
          await runList(list, 'Fase 2P');
          resRef.current['2P'] = { r1, r2 };
        } else if (stageId === '2D' || stageId === '2DR') {
          const titulo = stageId === '2D' ? 'Fase 2D: regra oculta' : 'Reteste 2D: regra oculta';
          await showInstr(
            titulo,
            <div className="space-y-3">
              <p>
                Agora não há símbolo nenhum. Em cada tentativa vale uma das duas regras. A regra permanece por um tempo e às vezes muda, sem aviso.
              </p>
              <p>
                O feedback está certo na maior parte das vezes, mas <strong>em parte das tentativas ele engana</strong>. Use o conjunto das respostas para decidir qual regra está valendo.
              </p>
              <p>Em algumas tentativas, depois da resposta, você dirá sua confiança.</p>
            </div>,
            'Começar'
          );
          const q = make2D(form, stageId);
          const rng = createRng(hashString(`PA|${form}|${stageId}|fig`));
          let prev: TrialSpec | null = null;
          const all = q.z.map((r, i) => {
            prev = createTrial('D', rng, r, prev, {
              n: i + 1,
              fb: 'q',
              flip: q.flips[i],
              lag: q.lag[i],
              conf: q.confSet.has(i),
              seg: '',
            });
            return prev;
          });
          for (let b = 0; b < 4; b++) {
            blockRef.current = b + 1;
            await runList(all.slice(b * 30, (b + 1) * 30), `${titulo.split(':')[0]} · bloco ${b + 1}/4`);
            if (b < 3) {
              await showInstr(
                'Pausa',
                <p className="text-slate-600">
                  Descanse o quanto quiser. A regra pode ter mudado ou não durante a pausa.
                </p>,
                'Continuar'
              );
            }
          }
          resRef.current[stageId] = { chg: q.chg };
        } else if (stageId === '1R') {
          await showInstr(
            'Reaquecimento',
            <p className="text-slate-600">Um bloco curto com as duas regras escritas, para lembrar a tarefa.</p>,
            'Começar'
          );
          blockRef.current = 1;
          const rng = rngFor(form, '1R');
          await runList(
            createSeries('O', rng, balRules(20, rng), (r) => ({ cue: { kind: 'word', rule: r } })),
            'Reaquecimento'
          );
        } else if (stageId === '3') {
          const rng = rngFor(form, '3-map');
          const sy = rng.shuffle(P_SYM);
          const M: Record<string, string> = {
            X1: sy[0], X2: sy[1], Y1: sy[2], Y2: sy[3],
            W1: sy[4], W2: sy[5], V1: sy[6], V2: sy[7],
          };
          const foils = sy.slice(8, 12);
          const R: Record<string, RuleCode> = {
            X1: 'A', Y1: 'A', W1: 'A', V1: 'A',
            X2: 'B', Y2: 'B', W2: 'B', V2: 'B',
          };
          await showInstr(
            'Fase 3: outros símbolos',
            <p className="text-slate-600">
              Símbolos totalmente novos. Cada um indica, ou não, uma das regras. Descubra pelo feedback.
            </p>,
            'Começar'
          );
          const sc = (names: string[], lbl: string) => ({
            cue: { kind: 'sym', syms: names } as CueSpec,
            cueName: lbl,
          });
          let b = 0;
          let ok = false;
          while (b < 4 && !ok) {
            b++;
            blockRef.current = b;
            const g = rngFor(form, `3-pre-${b}`);
            const list = createSeries('P', g, balRules(20, g), (r) => ({
              ...sc([M[r === 'A' ? 'X1' : 'X2']], r === 'A' ? 'X1' : 'X2'),
              tipo: 'pre',
            }));
            const s = await runList(list, `Fase 3 · etapa 1 · bloco ${b}`);
            ok = s.c >= 18;
            await showInstr(
              `Bloco ${b}: ${s.c} de 20`,
              <p className="text-slate-600">Critério: pelo menos 18 de 20.</p>,
              ok || b >= 4 ? 'Concluir' : 'Próximo bloco'
            );
          }

          await showInstr(
            'Agora, pares de símbolos',
            <p className="text-slate-600">Os símbolos aparecem aos pares. Continue respondendo, com feedback.</p>,
            'Continuar'
          );
          blockRef.current = 10;
          {
            const g = rngFor(form, '3-comp');
            const pairs = g.shuffle(
              Array.from({ length: 12 }, () => [
                ['X1', 'Y1'],
                ['X2', 'Y2'],
                ['W1', 'V1'],
                ['W2', 'V2'],
              ]).flat()
            );
            let prev: TrialSpec | null = null;
            const list = pairs.map((p) => {
              const order = g.shuffle(p);
              prev = createTrial('P', g, R[p[0]], prev, {
                ...sc(order.map((k) => M[k]), p.join('+')),
                tipo: 'composto',
              });
              return prev;
            });
            await runList(list, 'Fase 3 · etapa 2');
          }

          await showInstr(
            'Cada símbolo sozinho',
            <p className="text-slate-600">
              Agora cada símbolo aparece sozinho e não há feedback. Responda o que achar mais provável.
            </p>,
            'Continuar'
          );
          blockRef.current = 20;
          {
            const g = rngFor(form, '3-test');
            const cs = g.shuffle(Object.keys(M).flatMap((k) => [k, k, k, k]));
            let prev: TrialSpec | null = null;
            const list = cs.map((k) => {
              prev = createTrial('P', g, R[k], prev, {
                ...sc([M[k]], k),
                fb: false,
                tipo: `teste_${k[0]}`,
              });
              return prev;
            });
            await runList(list, 'Fase 3 · teste');
          }

          blockRef.current = 30;
          for (const k of rngFor(form, '3-rate').shuffle(Object.keys(M))) {
            checkAbort();
            setScreen({ kind: 'rating', symbol: M[k] });
            const r = await ask({
              keys: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7' },
              autoValue: () => '4',
            });
            if (r.abort) checkAbort();
            logRow({ n: 0, tipo: 'nota', pista: k, regra: R[k], resposta: Number(r.v) });
          }

          blockRef.current = 40;
          const recItems = rngFor(form, '3-rec').shuffle([
            ...Object.keys(M).map((k) => ({ k, s: M[k], old: 1 as const })),
            ...foils.map((s) => ({ k: 'foil', s, old: 0 as const })),
          ]);
          for (const it of recItems) {
            checkAbort();
            setScreen({ kind: 'recognition', symbol: it.s });
            const r = await ask({
              keys: { '1': '1', '2': '0' },
              autoValue: () => String(it.old),
            });
            if (r.abort) checkAbort();
            logRow({
              n: 0,
              tipo: 'reconhecimento',
              pista: it.k,
              antigo: it.old,
              resposta: Number(r.v),
              acerto: Number(r.v) === it.old ? 1 : 0,
            });
          }
          resRef.current['3'] = { map: M };
        } else if (stageId === 'corsi') {
          await showInstr(
            'Blocos: sequência espacial',
            <p className="text-slate-600">
              Quadrados acendem em sequência. Depois, toque neles <strong>na mesma ordem</strong>. A sequência cresce até você errar duas vezes no mesmo tamanho.
            </p>,
            'Começar'
          );
          const rng = rngFor(form, 'corsi');
          let L = 3;
          let best = 0;
          while (L <= 9) {
            let fails = 0;
            for (let k = 0; k < 2; k++) {
              blockRef.current = L;
              const seq = rng.shuffle(Array.from({ length: 9 }, (_, i) => i)).slice(0, L);
              setScreen({ kind: 'corsi', length: L, litIndex: null, status: 'Observe' });
              await waitMs(500);
              for (const idx of seq) {
                checkAbort();
                setScreen({ kind: 'corsi', length: L, litIndex: idx, status: 'Observe' });
                await waitMs(600);
                setScreen({ kind: 'corsi', length: L, litIndex: null, status: 'Observe' });
                await waitMs(250);
              }
              setScreen({ kind: 'corsi', length: L, litIndex: null, status: 'Sua vez' });
              const ans: number[] = [];
              for (let i = 0; i < L; i++) {
                const r = await ask({ autoValue: () => String(seq[ans.length]) });
                if (r.abort) checkAbort();
                const picked = Number(r.v);
                ans.push(picked);
                setScreen({ kind: 'corsi', length: L, litIndex: picked, status: 'Sua vez' });
                await waitMs(120);
                setScreen({ kind: 'corsi', length: L, litIndex: null, status: 'Sua vez' });
              }
              const ok = ans.join(',') === seq.join(',');
              logRow({ n: k + 1, tipo: 'corsi', tamanho: L, acerto: ok ? 1 : 0 });
              await waitMs(400);
              if (ok) best = Math.max(best, L);
              else fails++;
            }
            if (fails === 2) break;
            L++;
          }
          resRef.current.corsi = { span: best };
        } else if (stageId === 'dig') {
          await showInstr(
            'Dígitos em ordem inversa',
            <p className="text-slate-600">
              Dígitos aparecem um a um. Depois, digite-os <strong>do último para o primeiro</strong>.
            </p>,
            'Começar'
          );
          const rng = rngFor(form, 'dig');
          let L = 3;
          let best = 0;
          while (L <= 9) {
            let fails = 0;
            for (let k = 0; k < 2; k++) {
              blockRef.current = L;
              const seq: number[] = [];
              while (seq.length < L) {
                const d = rng.int(10);
                if (d !== seq[seq.length - 1]) seq.push(d);
              }
              setScreen({ kind: 'digits', length: L, displayDigit: '', showKeypad: false, inputValue: '' });
              await waitMs(400);
              for (const x of seq) {
                checkAbort();
                setScreen({ kind: 'digits', length: L, displayDigit: String(x), showKeypad: false, inputValue: '' });
                await waitMs(800);
                setScreen({ kind: 'digits', length: L, displayDigit: '', showKeypad: false, inputValue: '' });
                await waitMs(200);
              }
              let txt = '';
              const keys: Record<string, string> = { Enter: 'ok', Backspace: 'del' };
              for (let i = 0; i < 10; i++) keys[String(i)] = String(i);
              const rev = seq.slice().reverse().join('');
              for (;;) {
                setScreen({
                  kind: 'digits',
                  length: L,
                  displayDigit: txt || '·',
                  showKeypad: true,
                  inputValue: txt,
                });
                const r = await ask({
                  keys,
                  autoValue: () => (txt.length < L ? rev[txt.length] : 'ok'),
                });
                if (r.abort) checkAbort();
                if (r.v === 'ok') break;
                if (r.v === 'del') txt = txt.slice(0, -1);
                else if (r.v !== null && txt.length < 12) txt += r.v;
              }
              const ok = txt === rev;
              logRow({ n: k + 1, tipo: 'digitos', tamanho: L, acerto: ok ? 1 : 0 });
              if (ok) best = Math.max(best, L);
              else fails++;
            }
            if (fails === 2) break;
            L++;
          }
          resRef.current.dig = { span: best };
        } else if (stageId === 'spd') {
          await showInstr(
            'Velocidade: mesma forma?',
            <div className="space-y-3">
              <p>
                Duas figuras aparecem. Responda se têm a mesma forma, o mais rápido que conseguir, sem errar. A cor e o tamanho não contam. A tarefa dura 60 segundos.
              </p>
              <p>
                <strong>1</strong> = mesma forma · <strong>2</strong> = formas diferentes
              </p>
            </div>,
            'Começar'
          );
          const rng = rngFor(form, 'spd');
          const pool = [...SET.O, ...SET.T];
          const T0 = performance.now();
          let n = 0;
          blockRef.current = 1;
          while ((performance.now() - T0) * speedFactor < 60000 && n < (autoRun.enabled ? 20 : 999)) {
            checkAbort();
            n++;
            const same = rng() < 0.5;
            const a = rng.pick(pool);
            let b = a;
            if (!same) {
              do {
                b = rng.pick(pool);
              } while (b === a);
            }
            const rem = Math.max(0, 60 - Math.round(((performance.now() - T0) * speedFactor) / 1000));
            setScreen({
              kind: 'speed',
              hud: `${rem} s`,
              shapeA: a,
              colorA: rng.pick(COL),
              scaleA: rng.pick(SCL),
              shapeB: b,
              colorB: rng.pick(COL),
              scaleB: rng.pick(SCL),
            });
            const t0 = await nextFrame();
            const r = await ask({
              keys: { '1': '1', '2': '0' },
              timeout: 5000,
              autoValue: () => (same ? '1' : '0'),
            });
            if (r.abort) checkAbort();
            const rt = r.timeout ? null : Math.round(Math.max(r.ts, t0) - t0);
            logRow({
              n,
              tipo: 'velocidade',
              tr: rt,
              acerto: !r.timeout && Number(r.v) === (same ? 1 : 0) ? 1 : 0,
              omissao: r.timeout ? 1 : 0,
            });
            setScreen((prev) =>
              prev.kind === 'speed' ? { ...prev, shapeA: null, shapeB: null } : prev
            );
            await waitMs(200);
          }
        }

        const idx = STAGE_ORDER.indexOf(stageId);
        const outOfOrder = STAGE_ORDER.slice(0, idx).some(
          (k) => STAGE_META[k].session === STAGE_META[stageId].session && !state.done[k]
        );
        const doneAt = new Date().toISOString();
        const nextOoo = { ...state.ooo };
        if (outOfOrder) nextOoo[stageId] = true;
        else delete nextOoo[stageId];

        const nextState: AttentionState = {
          ...state,
          rows: [...state.rows.filter((r) => r.stage !== stageId), ...rowsRef.current],
          done: { ...state.done, [stageId]: doneAt },
          res: resRef.current,
          ooo: nextOoo,
        };

        if (isRemote && invite && remoteConfig) {
          const stageBody = {
            stage: stageId,
            submission: submissionRef.current,
            v: state.v,
            form: state.form,
            done: doneAt,
            ooo: outOfOrder,
            ctx: state.ctx,
            res: resRef.current,
            rows: rowsRef.current,
          };
          for (;;) {
            try {
              const resp = await sendEncryptedEnvelope(
                remoteConfig,
                invite.token,
                'stage',
                stageBody as unknown as { submission: string; rows: TrialRow[] }
              );
              if (!resp.ok) throw new Error(`Resposta ${resp.status}`);
              break;
            } catch (err) {
              await new Promise<void>((retryResolve) => {
                pendingRef.current = {
                  resolve: () => retryResolve(),
                };
                setScreen({
                  kind: 'saveError',
                  message: err instanceof Error ? err.message : 'Erro de rede',
                  onDownload: () => {
                    const blob = new Blob([JSON.stringify(stageBody)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `atencao_${state.code}_${stageId}.json`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  },
                });
              });
            }
          }
        }

        onComplete(nextState);
      } catch (err) {
        if (err instanceof AbortError) {
          void sendPartial('interrompida', true);
          onAbort('Fase interrompida. Nada foi gravado.');
          return;
        }
        void sendPartial('erro', true);
        setScreen({
          kind: 'fatalError',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };

    void executeStage();

    return () => {
      abortRef.current = true;
      if (pendingRef.current?.timerId !== undefined) {
        window.clearTimeout(pendingRef.current.timerId);
      }
    };
    // Executado uma única vez ao montar a fase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId]);

  const renderCue = (cue: CueSpec | null) => {
    if (!cue) return <div className="h-24" />;
    if (cue.kind === 'word') {
      return (
        <div className="h-24 flex items-center justify-center">
          <span className="text-2xl sm:text-3xl font-bold tracking-widest text-slate-900">
            {WORD[cue.rule]}
          </span>
        </div>
      );
    }
    if (cue.kind === 'sym') {
      return (
        <div className="h-24 flex items-center justify-center gap-5">
          {cue.syms.map((s, idx) => (
            <CueIcon key={`${s}-${idx}`} name={s} className="w-16 h-16 stroke-slate-900 fill-none" />
          ))}
        </div>
      );
    }
    if (cue.kind === 'arr') {
      return (
        <div className="min-h-24 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-1.5">
            {cue.slots.map((slot, idx) => (
              <div
                key={idx}
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center"
              >
                {slot ? (
                  <CueIcon name={slot} className="w-7 h-7 sm:w-10 sm:h-10 stroke-slate-900 fill-none" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                )}
              </div>
            ))}
          </div>
          {cue.word && (
            <span className="text-xl sm:text-2xl font-bold tracking-widest text-slate-900">
              {WORD[cue.word]}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="h-24 flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 7 }, (_, idx) => (
            <div
              key={idx}
              className="w-10 h-10 sm:w-14 sm:h-14 rounded-md border border-slate-300 cue-mask"
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 flex flex-col justify-between px-4 sm:px-6 py-6 select-none">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
        {screen.kind === 'instruction' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 my-auto">
            <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-500">
              <span>{STAGE_META[stageId].title}</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowQuickGuide(true)}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Instruções Rápidas</span>
                </button>
                <button
                  type="button"
                  onClick={tryExit}
                  className="text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Sair da fase
                </button>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{screen.title}</h1>
            <div className="text-slate-700 leading-relaxed space-y-3">{screen.body}</div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => resolveAsk({ v: 'go', ts: performance.now() })}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                {screen.btnLabel}
              </button>
              <button
                type="button"
                onClick={() => setShowQuickGuide(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:border-blue-500 hover:text-blue-700 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                <span>Instruções Rápidas</span>
              </button>
              <span className="text-xs text-slate-500">ou tecla Enter</span>
            </div>
          </div>
        )}

        {screen.kind === 'trial' && (
          <div className="flex-1 flex flex-col items-center justify-between py-2 gap-4">
            <div className="w-full flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
              <span>{screen.hud}</span>
              <button
                type="button"
                onClick={tryExit}
                className="font-sans font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Sair da fase
              </button>
            </div>

            <div className="w-full flex flex-col items-center justify-center gap-6 my-auto">
              {renderCue(screen.cue)}

              <div className="min-h-28 sm:min-h-32 flex items-center justify-center gap-2 sm:gap-4">
                {screen.phase === 'fixation' ? (
                  <span className="text-4xl font-light text-slate-400">+</span>
                ) : screen.trial ? (
                  <>
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                      <ShapeFigure
                        name={screen.trial.f[0]}
                        color={screen.trial.col[0]}
                        scale={screen.trial.sc[0]}
                      />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                      <ShapeFigure
                        name={screen.trial.f[1]}
                        color={screen.trial.col[1]}
                        scale={screen.trial.sc[1]}
                      />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <span className="text-3xl font-semibold text-slate-400">?</span>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="min-h-32 sm:min-h-36 flex items-center justify-center gap-3 sm:gap-6">
                {screen.trial &&
                  screen.trial.order.map((role, p) => {
                    const selected = screen.selectedPos === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-label={`Opção ${p + 1}`}
                        onClick={() => resolveAsk({ v: String(p), ts: performance.now() })}
                        className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
                      >
                        <div
                          className={`w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-white flex items-center justify-center transition-colors ${
                            selected
                              ? 'border-2 border-slate-900'
                              : 'border-2 border-slate-200 group-hover:border-blue-600'
                          }`}
                        >
                          <ShapeFigure
                            name={screen.trial!.f[role]}
                            color={screen.trial!.col[2 + p]}
                            scale={screen.trial!.sc[2 + p]}
                          />
                        </div>
                        <kbd className="font-mono text-xs font-semibold text-slate-500 group-hover:text-blue-600">
                          {p + 1}
                        </kbd>
                      </button>
                    );
                  })}
              </div>

              <div className="min-h-10 flex items-center justify-center">
                {screen.feedbackText && (
                  <span
                    className={`text-xl font-bold ${
                      screen.feedbackTone === 'ok'
                        ? 'text-emerald-700'
                        : screen.feedbackTone === 'no'
                          ? 'text-red-600'
                          : 'text-slate-500 text-base font-medium'
                    }`}
                  >
                    {screen.feedbackText}
                  </span>
                )}
              </div>

              <div className="min-h-16 flex flex-col items-center gap-2">
                {screen.showConfidence && (
                  <>
                    <span className="text-xs font-medium text-slate-500">
                      Confiança nesta resposta (1 = chute, 4 = certeza)
                    </span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => resolveAsk({ v: String(v), ts: performance.now() })}
                          className="w-11 h-11 rounded-lg bg-white border border-slate-300 font-mono text-sm font-semibold text-slate-900 hover:border-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {screen.kind === 'symbolCheck' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 my-auto">
            <h2 className="text-xl font-bold text-slate-900">Qual regra este símbolo indica?</h2>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg inline-flex">
              <CueIcon name={screen.symbol} className="w-16 h-16 stroke-slate-900 fill-none" />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => resolveAsk({ v: 'A', ts: performance.now() })}
                className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600 cursor-pointer"
              >
                1 · Repetição
              </button>
              <button
                type="button"
                onClick={() => resolveAsk({ v: 'B', ts: performance.now() })}
                className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600 cursor-pointer"
              >
                2 · Exclusão
              </button>
            </div>
          </div>
        )}

        {screen.kind === 'rating' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 my-auto">
            <h2 className="text-xl font-bold text-slate-900">
              O quanto este símbolo indica cada regra?
            </h2>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg inline-flex">
              <CueIcon name={screen.symbol} className="w-16 h-16 stroke-slate-900 fill-none" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => resolveAsk({ v: String(v), ts: performance.now() })}
                  className="w-11 h-11 rounded-lg bg-white border border-slate-300 font-mono text-sm font-semibold text-slate-900 hover:border-blue-600 cursor-pointer"
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              1 = certamente Repetição · 4 = não indica nada · 7 = certamente Exclusão
            </p>
          </div>
        )}

        {screen.kind === 'recognition' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 my-auto">
            <h2 className="text-xl font-bold text-slate-900">Você viu este símbolo nesta fase?</h2>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg inline-flex">
              <CueIcon name={screen.symbol} className="w-16 h-16 stroke-slate-900 fill-none" />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => resolveAsk({ v: '1', ts: performance.now() })}
                className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600 cursor-pointer"
              >
                1 · Sim
              </button>
              <button
                type="button"
                onClick={() => resolveAsk({ v: '0', ts: performance.now() })}
                className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600 cursor-pointer"
              >
                2 · Não
              </button>
            </div>
          </div>
        )}

        {screen.kind === 'corsi' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="w-full flex items-center justify-between text-xs font-mono text-slate-500">
              <span>Sequência de {screen.length}</span>
              <button
                type="button"
                onClick={tryExit}
                className="font-sans font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Sair da fase
              </button>
            </div>
            <div className="relative w-full max-w-[420px] aspect-square bg-white border border-slate-200 rounded-xl">
              {CORSI_POSITIONS.map((c, idx) => {
                const active = screen.litIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Bloco ${idx + 1}`}
                    onClick={() => resolveAsk({ v: String(idx), ts: performance.now() })}
                    style={{ left: `${c[0]}%`, top: `${c[1]}%` }}
                    className={`absolute w-[15%] h-[15%] rounded-md border transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600 border-blue-700'
                        : 'bg-slate-100 border-slate-300 hover:border-blue-500'
                    }`}
                  />
                );
              })}
            </div>
            <p className="text-sm font-medium text-slate-600">{screen.status}</p>
          </div>
        )}

        {screen.kind === 'digits' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="w-full flex items-center justify-between text-xs font-mono text-slate-500">
              <span>{screen.length} dígitos</span>
              <button
                type="button"
                onClick={tryExit}
                className="font-sans font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Sair da fase
              </button>
            </div>
            <div className="text-6xl font-mono font-bold text-slate-900 min-h-20 flex items-center justify-center">
              {screen.displayDigit}
            </div>
            {screen.showKeypad && (
              <div className="grid grid-cols-3 gap-2 w-52">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => resolveAsk({ v: String(v), ts: performance.now() })}
                    className="h-14 rounded-lg bg-white border border-slate-300 font-mono text-lg font-semibold text-slate-900 hover:border-blue-600 cursor-pointer"
                  >
                    {v}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => resolveAsk({ v: 'del', ts: performance.now() })}
                  className="h-14 rounded-lg bg-slate-100 border border-slate-300 font-mono text-base font-semibold text-slate-700 hover:border-slate-500 cursor-pointer"
                >
                  ⌫
                </button>
                <button
                  type="button"
                  onClick={() => resolveAsk({ v: '0', ts: performance.now() })}
                  className="h-14 rounded-lg bg-white border border-slate-300 font-mono text-lg font-semibold text-slate-900 hover:border-blue-600 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => resolveAsk({ v: 'ok', ts: performance.now() })}
                  className="h-14 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 cursor-pointer"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        )}

        {screen.kind === 'speed' && (
          <div className="flex-1 flex flex-col items-center justify-between py-2 gap-6">
            <div className="w-full flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
              <span>{screen.hud}</span>
              <button
                type="button"
                onClick={tryExit}
                className="font-sans font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Sair da fase
              </button>
            </div>
            <div className="my-auto flex flex-col items-center gap-8">
              <div className="min-h-32 flex items-center justify-center gap-6">
                {screen.shapeA && screen.shapeB && (
                  <>
                    <div className="w-28 h-28 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                      <ShapeFigure
                        name={screen.shapeA}
                        color={screen.colorA}
                        scale={screen.scaleA}
                      />
                    </div>
                    <div className="w-28 h-28 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                      <ShapeFigure
                        name={screen.shapeB}
                        color={screen.colorB}
                        scale={screen.scaleB}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => resolveAsk({ v: '1', ts: performance.now() })}
                  className="px-5 py-3 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600 cursor-pointer"
                >
                  1 · Mesma
                </button>
                <button
                  type="button"
                  onClick={() => resolveAsk({ v: '0', ts: performance.now() })}
                  className="px-5 py-3 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600 cursor-pointer"
                >
                  2 · Diferente
                </button>
              </div>
            </div>
          </div>
        )}

        {screen.kind === 'saveError' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4 my-auto">
            <h2 className="text-xl font-bold text-slate-900">Esta fase ainda não foi salva</h2>
            <p className="text-sm text-slate-600">
              Confira sua conexão com a internet e não feche esta página.
            </p>
            <p className="font-mono text-xs text-red-600">{screen.message}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => resolveAsk({ v: 'retry', ts: performance.now() })}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={screen.onDownload}
                className="px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Baixar uma cópia em JSON
              </button>
            </div>
          </div>
        )}

        {screen.kind === 'fatalError' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4 my-auto">
            <h2 className="text-xl font-bold text-slate-900">A fase parou por um erro</h2>
            <p className="font-mono text-xs text-red-600">{screen.message}</p>
            <button
              type="button"
              onClick={() => onAbort('Erro ao executar fase.')}
              className="px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              Voltar
            </button>
          </div>
        )}
      </div>

      {exitToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium z-30">
          {exitToast}
        </div>
      )}

      <QuickInstructionsModal
        stageId={stageId}
        open={showQuickGuide}
        onClose={() => setShowQuickGuide(false)}
      />
    </div>
  );
};
