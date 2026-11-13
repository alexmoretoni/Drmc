import React from 'react';
import { ArrowRight } from 'lucide-react';
import { COL, FORM, IC, NOME } from '../engine/stimuli';

interface ShapeFigureProps {
  name: string;
  color?: string;
  scale?: number;
  className?: string;
}

export const ShapeFigure: React.FC<ShapeFigureProps> = ({
  name,
  color = '#334155',
  scale = 1,
  className = 'w-4/5 h-4/5 overflow-visible',
}) => {
  const path = FORM[name] || '';
  return (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden="true">
      <path d={path} fill={color} fillRule="evenodd" transform={`scale(${scale})`} />
    </svg>
  );
};

interface CueIconProps {
  name: string;
  className?: string;
}

export const CueIcon: React.FC<CueIconProps> = ({
  name,
  className = 'w-14 h-14 stroke-slate-800 fill-none',
}) => {
  const path = IC[name] || '';
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
};

export const ExampleSequence: React.FC<{ goodIndex: 0 | 2 }> = ({ goodIndex }) => {
  const f1 = 'barra';
  const f2 = 'halter';
  const f3 = goodIndex === 0 ? 'barra' : 'gancho';
  return (
    <div className="flex items-center gap-2.5 flex-wrap py-1">
      <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
        <ShapeFigure name={f1} color={COL[4]} />
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
        <ShapeFigure name={f2} color={COL[1]} />
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      <div className="w-16 h-16 rounded-lg bg-emerald-50 border-2 border-emerald-600 flex items-center justify-center">
        <ShapeFigure name={f3} color={COL[3]} scale={0.9} />
      </div>
    </div>
  );
};

export const SymbolLegend: React.FC<{ left: string; right: string }> = ({ left, right }) => (
  <div className="flex items-center gap-8 py-2">
    {[left, right].map((sym) => (
      <div key={sym} className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg bg-slate-100 border border-slate-200">
        <CueIcon name={sym} className="w-12 h-12 stroke-slate-800 fill-none" />
        <span className="text-xs font-medium text-slate-600">{NOME[sym] || sym}</span>
      </div>
    ))}
  </div>
);
