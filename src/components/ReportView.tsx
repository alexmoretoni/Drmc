import React, { useMemo, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';
import {
  compute2AReport,
  compute2BReport,
  compute2CReport,
  compute2DReport,
  compute2PReport,
  compute3Report,
  computeLearnBlockReport,
  rowsOf,
  toCSV,
} from '../engine/analytics';
import { exportReportToPdf } from '../engine/pdfExport';
import { formatMs, formatNum, formatPct, median } from '../engine/rng';
import { NOME, RN } from '../engine/stimuli';
import { AttentionState } from '../types/protocol';
import { LagAccuracyChart, TimelineChart } from './ReportCharts';

interface ReportViewProps {
  state: AttentionState;
  onBack: () => void;
}

const KvGrid: React.FC<{ items: Array<[string, string | number]> }> = ({ items }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
    {items.map(([label, val]) => (
      <div key={label} className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-0.5 text-lg font-semibold font-mono tabular-nums text-slate-900">{val}</div>
      </div>
    ))}
  </div>
);

const DataTable: React.FC<{ headers: string[]; rows: Array<Array<string | number>> }> = ({
  headers,
  rows,
}) => (
  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm font-mono tabular-nums">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-sans font-semibold text-slate-600">
            {headers.map((h) => (
              <th key={h} className="py-2.5 px-3.5 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/70">
              {r.map((cell, j) => (
                <td key={j} className="py-2.5 px-3.5 text-slate-800 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const ReportView: React.FC<ReportViewProps> = ({ state, onBack }) => {
  const reportRef = useRef<HTMLElement | null>(null);
  const [copiedNotice, setCopiedNotice] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [fallbackCsv, setFallbackCsv] = useState<string | null>(null);

  const d2d = useMemo(() => compute2DReport(state, '2D'), [state]);
  const d2dr = useMemo(() => compute2DReport(state, '2DR'), [state]);
  const d2c = useMemo(() => compute2CReport(state), [state]);
  const d2p = useMemo(() => compute2PReport(state), [state]);
  const d2a = useMemo(() => compute2AReport(state), [state]);
  const d2b = useMemo(() => compute2BReport(state), [state]);
  const d3 = useMemo(() => compute3Report(state), [state]);
  const d1a = useMemo(() => computeLearnBlockReport(state, '1A'), [state]);
  const d1b = useMemo(() => computeLearnBlockReport(state, '1B'), [state]);

  const speedRows = useMemo(() => rowsOf(state, 'spd'), [state]);
  const speedCorrect = speedRows.filter((r) => r.acerto === 1).length;
  const speedRt = median(
    speedRows.filter((r) => (r.tr || 0) >= 150 && r.acerto === 1).map((r) => r.tr as number)
  );

  const hasOutOfOrder = Object.keys(state.ooo).some((k) => state.ooo[k as keyof typeof state.ooo]);
  const stamp = `atencao_${state.code || 'anon'}_${state.form}`;

  const downloadText = (filename: string, text: string, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleCopyCsv = async () => {
    const csv = toCSV(state.rows);
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedNotice('CSV copiado para a área de transferência.');
      setTimeout(() => setCopiedNotice(''), 2500);
    } catch {
      setFallbackCsv(csv);
      setCopiedNotice('Selecione e copie o texto abaixo.');
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportReportToPdf(state, reportRef.current);
      setCopiedNotice('Relatório PDF gerado e baixado.');
      setTimeout(() => setCopiedNotice(''), 3000);
    } catch {
      setCopiedNotice('Não foi possível gerar o PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const render2DSection = (key: '2D' | '2DR', title: string, data: ReturnType<typeof compute2DReport>) => (
    <section className="space-y-4 pt-6 border-t border-slate-200">
      <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
      {!data ? (
        <p className="text-sm text-slate-500">Não realizada ou incompleta (necessárias 120 tentativas).</p>
      ) : (
        <div className="space-y-4">
          <KvGrid
            items={[
              ['Sua acurácia', formatPct(data.acc, 1)],
              ['Ideal, mesma evidência', formatPct(data.idealAcc, 1)],
              ['Ganha-fica / perde-troca', formatPct(data.wslsAcc, 1)],
              ['Concordância com o ideal', formatPct(data.agreement, 1)],
              ['Escolhas da figura 2', data.f2Count],
              ['TR mediano', formatMs(data.medianRt)],
            ]}
          />

          <TimelineChart rows={data.rows} beliefs={data.beliefs} chartId={`${key}-timeline`} />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Acerto por distância até a troca</h3>
            <LagAccuracyChart me={data.meByLag} ideal={data.idealByLag} labels={data.labels} chartId={`${key}-lag`} />
          </div>

          <DataTable
            headers={['Tentativas após a troca', ...data.labels]}
            rows={[
              ['Você', ...data.meByLag.map((v) => formatPct(v))],
              ['Ideal', ...data.idealByLag.map((v) => formatPct(v))],
              ['Confiança média (1 a 4)', ...data.confByLag.map((v) => formatNum(v, 1))],
            ]}
          />

          {data.fit && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">
                Ajuste de modelos ({data.fit.n} escolhas)
              </h3>
              <DataTable
                headers={['Modelo', 'BIC', 'Parâmetros estimados']}
                rows={data.fit.all.map((m) => [m.nome, formatNum(m.bic, 1), m.par])}
              />
              <p className="text-xs text-slate-500">
                Menor BIC indica melhor ajuste. O valor verdadeiro da taxa de mudança é h = 0,05. Em uma única sessão de 120 tentativas, trate os parâmetros como indicativos.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );

  return (
    <main ref={reportRef} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Relatório individual
          </h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            {state.code ? `${state.code} · ` : ''}Forma {state.form}. Não há valores normativos de referência: os parâmetros de comparação são o nível de acaso (33%) e o observador ideal bayesiano.
          </p>
          {hasOutOfOrder && (
            <p className="text-xs font-medium text-amber-700">
              Aviso: há fases realizadas fora da ordem recomendada. Elas permanecem marcadas nos registros exportados.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" aria-hidden="true" />
            <span>{exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-400 cursor-pointer"
          >
            Voltar ao protocolo
          </button>
        </div>
      </div>

      {render2DSection('2D', 'Fase 2D: inferência sem pista', d2d)}
      {render2DSection('2DR', 'Reteste da 2D', d2dr)}

      <section className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fase 2C: reversão</h2>
        {!d2c ? (
          <p className="text-sm text-slate-500">Não realizada.</p>
        ) : (
          <div className="space-y-3">
            <DataTable
              headers={[
                'Reversão',
                'Tentativas até 4 acertos',
                'Outra pista após erro',
                'Repetiu antiga após erro',
                'TR antes',
                'TR depois',
              ]}
              rows={d2c.lines}
            />
            <KvGrid
              items={[
                ['Erro antes da 1ª reversão', d2c.preRevError],
                ['Sondas invertidas (Losango/Estrela)', d2c.probesInverted],
              ]}
            />
            <p className="text-xs text-slate-500">
              A primeira tentativa da outra pista mede inferência de estado latente: acertar sem erro prévio naquela pista sugere inversão do par completo. As sondas avaliam transferência para símbolos não revertidos.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Fase 2P: pista probabilística
        </h2>
        {!d2p ? (
          <p className="text-sm text-slate-500">Não realizada.</p>
        ) : (
          <div className="space-y-3">
            <KvGrid
              items={[
                ['Acerto (teto 80%)', d2p.acc],
                ['Seguiu a regra mais provável', d2p.mostProbable],
                ['Trocou após exceção isolada', d2p.switchedAfterExc],
                ['Adaptação 1ª reversão', d2p.adapt1],
                ['Adaptação 2ª reversão', d2p.adapt2],
              ]}
            />
            <p className="text-xs text-slate-500">
              Seguir sempre a regra mais provável alcança cerca de 80% de acerto; alternar na proporção dos resultados, cerca de 68%. Trocar após exceção isolada sugere instabilidade ao ruído; demorar após reversão sugere rigidez.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fase 2A: generalização</h2>
        {!d2a ? (
          <p className="text-sm text-slate-500">Não realizada.</p>
        ) : (
          <div className="space-y-3">
            <KvGrid
              items={[
                ['Duração calibrada da pista', d2a.cueMs],
                ['Limiar da escada', d2a.thr],
                ['Reversões na escada', d2a.reversoes],
                ['Lapsos (figura 2)', d2a.lapsos],
              ]}
            />
            <DataTable
              headers={[
                'Condição',
                'Acerto explícita',
                'Acerto inferida',
                'Custo de seleção',
                'TR explícita',
                'TR inferida',
              ]}
              rows={d2a.rows}
            />
          </div>
        )}
      </section>

      <section className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fase 2B: reassociação</h2>
        {!d2b ? (
          <p className="text-sm text-slate-500">Não realizada.</p>
        ) : (
          <div className="space-y-3">
            <KvGrid
              items={[
                ['Acerto nas 10 primeiras', d2b.first10],
                ['1ª ocorrência do 2º símbolo', d2b.secondCueFirst],
                ['Tentativas de aprendizagem', d2b.totalLearn],
                ['Critério', d2b.passed],
                ['Teste, figuras inéditas', d2b.testNovel],
                ['Teste, Lua e Sol', d2b.testOld],
              ]}
            />
            <p className="text-xs text-slate-500">
              A primeira ocorrência do segundo símbolo mede exclusividade mútua em tentativa única.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fase 3: blocking</h2>
        {!d3 ? (
          <p className="text-sm text-slate-500">Não realizada.</p>
        ) : (
          <div className="space-y-3">
            <DataTable
              headers={['Pista', 'Escolha esperada', 'Nota (−3 a +3)', 'Reconhecimento']}
              rows={d3.rows}
            />
            <KvGrid
              items={[
                ['BI (escolha): V − Y', d3.biChoice],
                ['BI (nota): V − Y', d3.biRating],
              ]}
            />
            <p className="text-xs text-slate-500">
              Valores positivos do índice de bloqueio (BI) indicam menor aprendizagem sobre Y do que sobre V. Interpretar apenas se X e V estiverem acima do acaso.
            </p>
          </div>
        )}
      </section>

      {(['1A', '1B'] as const).map((s) => {
        const d = s === '1A' ? d1a : d1b;
        return (
          <section key={s} className="space-y-4 pt-6 border-t border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fase {s}</h2>
            {!d ? (
              <p className="text-sm text-slate-500">Não realizada.</p>
            ) : (
              <div className="space-y-3">
                <KvGrid
                  items={[
                    ['Critério', d.criterion],
                    ['Tentativas', d.trials],
                    ['TR mediano (acertos)', d.medianRt],
                    ['Erros Repetição / Exclusão', d.errorsAB],
                    ['Lapsos (figura 2)', d.lapses],
                    ['Omissões', d.omissions],
                  ]}
                />
                <DataTable headers={['Bloco', 'Acertos']} rows={d.blocks} />
                {d.checks.length > 0 && (
                  <p className="text-xs text-slate-600">
                    Teste explícito dos símbolos:{' '}
                    {d.checks
                      .map(
                        (r) =>
                          `${NOME[r.pista || ''] || r.pista} → ${RN[r.resposta as 'A' | 'B']} (${
                            r.acerto ? 'certo' : 'errado'
                          })`
                      )
                      .join(' · ')}
                  </p>
                )}
              </div>
            )}
          </section>
        );
      })}

      <section className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Memória e velocidade</h2>
        <KvGrid
          items={[
            ['Blocos, maior sequência', state.res.corsi ? state.res.corsi.span : '–'],
            ['Dígitos inversos, maior sequência', state.res.dig ? state.res.dig.span : '–'],
            ['Velocidade, acertos em 60 s', speedRows.length ? speedCorrect : '–'],
            ['Velocidade, TR mediano', speedRows.length ? formatMs(speedRt) : '–'],
          ]}
        />
      </section>

      <section className="space-y-4 pt-6 border-t border-slate-200">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Exportar dados</h2>
          <p className="text-xs font-mono tabular-nums text-slate-500">
            {state.rows.length} linhas registradas tentativa a tentativa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            <FileDown className="w-4 h-4" aria-hidden="true" />
            <span>{exportingPdf ? 'Gerando PDF...' : 'Baixar PDF formatado'}</span>
          </button>
          <button
            type="button"
            onClick={() => downloadText(`${stamp}.csv`, toCSV(state.rows), 'text/csv;charset=utf-8')}
            className="px-4 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg hover:border-slate-400 cursor-pointer"
          >
            Baixar CSV
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(`${stamp}.json`, JSON.stringify(state, null, 2), 'application/json')
            }
            className="px-4 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg hover:border-slate-400 cursor-pointer"
          >
            Baixar JSON
          </button>
          <button
            type="button"
            onClick={handleCopyCsv}
            className="px-4 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg hover:border-slate-400 cursor-pointer"
          >
            Copiar CSV
          </button>
        </div>

        {copiedNotice && <p className="text-xs font-medium text-emerald-700">{copiedNotice}</p>}
        {fallbackCsv !== null && (
          <textarea
            readOnly
            value={fallbackCsv}
            aria-label="Dados em CSV"
            className="w-full h-36 p-3 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800"
          />
        )}
      </section>
    </main>
  );
};
