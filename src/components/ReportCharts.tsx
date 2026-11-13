import React, { useState } from 'react';
import { formatNum, formatPct } from '../engine/rng';
import { RN } from '../engine/stimuli';
import { TrialRow } from '../types/protocol';

interface TimelineChartProps {
  rows: TrialRow[];
  beliefs: number[];
  chartId?: string;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({ rows, beliefs, chartId }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 720;
  const H = 210;
  const L = 44;
  const R = 16;
  const T = 16;
  const B = 28;
  const n = rows.length;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const bw = plotW / n;
  const x = (i: number) => L + (i + 0.5) * bw;
  const y = (v: number) => T + (1 - v) * plotH;

  const beliefPath = beliefs
    .map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(b).toFixed(2)}`)
    .join('');

  const hovered = hoverIdx !== null ? rows[hoverIdx] : null;
  const hoveredBel = hoverIdx !== null ? beliefs[hoverIdx] : null;

  return (
    <div className="space-y-3">
      <div className="relative bg-white border border-slate-200 rounded-lg p-3">
        <div className="min-h-5 mb-1 text-xs font-mono tabular-nums text-slate-600 flex items-center justify-between gap-2">
          {hovered && hoveredBel !== null ? (
            <span>
              Tentativa {hoverIdx! + 1} · Regra: {hovered.regra ? RN[hovered.regra] : '–'} · Resposta:{' '}
              {hovered.papel || 'omissão'} · Feedback: {hovered.fb} · Crença ideal Rep:{' '}
              {formatNum(hoveredBel)}
            </span>
          ) : (
            <span className="text-slate-400">Passe o cursor sobre as tentativas para inspecionar os detalhes</span>
          )}
        </div>

        <svg
          data-chart-id={chartId}
          className="w-full h-auto block select-none cursor-crosshair"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Regra oculta, escolhas e crença do observador ideal ao longo de 120 tentativas"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {rows.map((r, i) => (
            <rect
              key={`bg-${i}`}
              x={L + i * bw}
              y={T}
              width={bw + 0.5}
              height={plotH}
              fill={r.regra === 'A' ? '#EFF6FF' : '#FFFBEB'}
            />
          ))}

          {[0, 0.5, 1].map((v) => (
            <g key={`y-${v}`}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeWidth={1} strokeDasharray={v === 0.5 ? '3 3' : undefined} />
              <text
                x={L - 8}
                y={y(v) + 4}
                textAnchor="end"
                fill="#64748B"
                fontSize="11"
                fontFamily="monospace"
                className="fill-slate-500 text-[11px] font-mono"
              >
                {v === 1 ? 'Rep' : v === 0 ? 'Exc' : '0,5'}
              </text>
            </g>
          ))}

          {[30, 60, 90, 120].map((tick) => (
            <text
              key={`x-${tick}`}
              x={L + tick * bw}
              y={H - 8}
              textAnchor="end"
              fill="#64748B"
              fontSize="11"
              fontFamily="monospace"
              className="fill-slate-500 text-[11px] font-mono"
            >
              {tick}
            </text>
          ))}

          <path d={beliefPath} fill="none" stroke="#D97706" strokeWidth={2} />

          {rows.map((r, i) => {
            if (r.papel !== 'F1' && r.papel !== 'nova') return null;
            const val = r.papel === 'F1' ? 0.96 : 0.04;
            return (
              <circle
                key={`pt-${i}`}
                cx={x(i)}
                cy={y(val)}
                r={3}
                fill={r.acerto ? '#2563EB' : '#FFFFFF'}
                stroke="#2563EB"
                strokeWidth={1.3}
              />
            );
          })}

          {hoverIdx !== null && (
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={T}
              y2={T + plotH}
              stroke="#0F172A"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}

          {rows.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={L + i * bw}
              y={T}
              width={bw + 0.5}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          ))}
        </svg>

        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-2.5 rounded-sm bg-blue-50 border border-blue-200 inline-block" />
            Regra vigente: Repetição
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-2.5 rounded-sm bg-amber-50 border border-amber-200 inline-block" />
            Regra vigente: Exclusão
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-amber-600 inline-block" />
            Crença do observador ideal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            Sua escolha (vazia = errada)
          </span>
        </div>
      </div>
    </div>
  );
};

interface LagAccuracyChartProps {
  me: number[];
  ideal: number[];
  labels: string[];
  chartId?: string;
}

export const LagAccuracyChart: React.FC<LagAccuracyChartProps> = ({ me, ideal, labels, chartId }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 720;
  const H = 230;
  const L = 44;
  const R = 76;
  const T = 20;
  const B = 36;
  const plotW = W - L - R;
  const plotH = H - T - B;

  const x = (i: number) => L + (i * plotW) / Math.max(1, labels.length - 1);
  const y = (v: number) => T + (1 - v) * plotH;

  const buildPath = (data: number[]) => {
    let d = '';
    let started = false;
    data.forEach((v, i) => {
      if (Number.isNaN(v)) {
        started = false;
        return;
      }
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      started = true;
    });
    return d;
  };

  const endLabel = (data: number[], text: string, color: string) => {
    let i = data.length - 1;
    while (i >= 0 && Number.isNaN(data[i])) i--;
    if (i < 0) return null;
    return (
      <text
        x={x(i) + 10}
        y={y(data[i]) + 4}
        fontSize="12"
        fontFamily="sans-serif"
        fontWeight="600"
        fill={color}
        className="text-xs font-semibold"
      >
        {text}
      </text>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="min-h-5 text-xs font-mono tabular-nums text-slate-600">
        {hoverIdx !== null ? (
          <span>
            Distância {labels[hoverIdx]} após a troca · Você: {formatPct(me[hoverIdx])} · Ideal:{' '}
            {formatPct(ideal[hoverIdx])}
          </span>
        ) : (
          <span className="text-slate-400">% de acerto estratificado por distância até a troca de regra</span>
        )}
      </div>

      <svg
        data-chart-id={chartId}
        className="w-full h-auto block select-none"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Acurácia por distância até a troca de regra"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={`g-${v}`}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeWidth={1} />
            <text
              x={L - 8}
              y={y(v) + 4}
              textAnchor="end"
              fill="#64748B"
              fontSize="11"
              fontFamily="monospace"
              className="fill-slate-500 text-[11px] font-mono"
            >
              {v * 100}%
            </text>
          </g>
        ))}

        {labels.map((lbl, i) => (
          <text
            key={lbl}
            x={x(i)}
            y={H - 12}
            textAnchor="middle"
            fill="#64748B"
            fontSize="11"
            fontFamily="monospace"
            className="fill-slate-500 text-[11px] font-mono"
          >
            {lbl}
          </text>
        ))}

        <path d={buildPath(ideal)} fill="none" stroke="#D97706" strokeWidth={2} strokeDasharray="5 4" />
        <path d={buildPath(me)} fill="none" stroke="#2563EB" strokeWidth={2.5} />

        {ideal.map((v, i) =>
          Number.isNaN(v) ? null : (
            <circle
              key={`id-${i}`}
              cx={x(i)}
              cy={y(v)}
              r={4.5}
              fill="#D97706"
              stroke="#FFFFFF"
              strokeWidth={1.5}
              onMouseEnter={() => setHoverIdx(i)}
              className="cursor-pointer"
            />
          )
        )}

        {me.map((v, i) =>
          Number.isNaN(v) ? null : (
            <circle
              key={`me-${i}`}
              cx={x(i)}
              cy={y(v)}
              r={5}
              fill="#2563EB"
              stroke="#FFFFFF"
              strokeWidth={2}
              onMouseEnter={() => setHoverIdx(i)}
              className="cursor-pointer"
            />
          )
        )}

        {endLabel(me, 'Você', '#2563EB')}
        {endLabel(ideal, 'Ideal', '#D97706')}
      </svg>
    </div>
  );
};
