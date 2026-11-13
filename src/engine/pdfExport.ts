import { jsPDF } from 'jspdf';
import {
  compute2AReport,
  compute2BReport,
  compute2CReport,
  compute2DReport,
  compute2PReport,
  compute3Report,
  computeLearnBlockReport,
  rowsOf,
} from './analytics';
import { formatMs, formatNum, formatPct, median } from './rng';
import { NOME, RN } from './stimuli';
import { STAGE_ORDER } from './stages';
import { AttentionState } from '../types/protocol';

async function svgToPngDataUrl(svgEl: SVGSVGElement): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    const vb = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number);
    const w = vb && vb.length === 4 ? vb[2] : svgEl.clientWidth || 720;
    const h = vb && vb.length === 4 ? vb[3] : svgEl.clientHeight || 220;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Fundo branco garantido para renderização limpa no PDF
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);

    // Garante estilos computados em elementos <text>
    clone.querySelectorAll('text').forEach((txt) => {
      if (!txt.getAttribute('fill')) txt.setAttribute('fill', '#64748b');
      if (!txt.getAttribute('font-family')) txt.setAttribute('font-family', 'sans-serif');
      if (!txt.getAttribute('font-size')) txt.setAttribute('font-size', '11');
    });

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    return { dataUrl: canvas.toDataURL('image/png'), ratio: h / w };
  } catch {
    return null;
  }
}

export async function exportReportToPdf(
  state: AttentionState,
  chartContainer?: HTMLElement | null
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = 16;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(14);
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentW, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 5;
  };

  const drawNote = (text: string, color: [number, number, number] = [71, 85, 105]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentW);
    ensureSpace(lines.length * 4 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  };

  const drawKvGrid = (items: Array<[string, string | number]>) => {
    const cols = 3;
    const gap = 3;
    const boxW = (contentW - gap * (cols - 1)) / cols;
    const boxH = 13;

    for (let i = 0; i < items.length; i += cols) {
      ensureSpace(boxH + 3);
      const slice = items.slice(i, i + cols);
      slice.forEach(([label, val], colIdx) => {
        const x = margin + colIdx * (boxW + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(String(label).slice(0, 34), x + 2.5, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(String(val), x + 2.5, y + 10);
      });
      y += boxH + 2.5;
    }
    y += 1.5;
  };

  const drawTable = (headers: string[], rows: Array<Array<string | number>>) => {
    if (!rows.length) return;
    const colW = contentW / headers.length;
    const rowH = 6.5;
    ensureSpace(rowH * 2 + 4);

    // Cabeçalho
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentW, rowH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    headers.forEach((h, idx) => {
      const clipped = doc.splitTextToSize(String(h), colW - 3)[0] || '';
      doc.text(clipped, margin + idx * colW + 1.8, y + 4.4);
    });
    y += rowH;

    // Linhas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    rows.forEach((r) => {
      ensureSpace(rowH + 1);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentW, rowH, 'D');
      doc.setTextColor(15, 23, 42);
      r.forEach((cell, idx) => {
        const clipped = doc.splitTextToSize(String(cell), colW - 3)[0] || '';
        doc.text(clipped, margin + idx * colW + 1.8, y + 4.4);
      });
      y += rowH;
    });
    y += 3;
  };

  const embedChart = async (chartId: string, caption: string) => {
    if (!chartContainer) return;
    const el = chartContainer.querySelector<SVGSVGElement>(`[data-chart-id="${chartId}"]`);
    if (!el) return;
    const rendered = await svgToPngDataUrl(el);
    if (!rendered) return;
    const imgW = contentW;
    const imgH = Math.min(62, imgW * rendered.ratio);
    ensureSpace(imgH + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(caption, margin, y);
    y += 3;
    doc.addImage(rendered.dataUrl, 'PNG', margin, y, imgW, imgH);
    y += imgH + 4;
  };

  // Cabeçalho do documento
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentW, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('Projeto Atenção — Relatório Clínico Individual', margin + 4, y + 7.5);

  const doneCount = STAGE_ORDER.filter((id) => Boolean(state.done[id])).length;
  const completionPct = Math.round((doneCount / STAGE_ORDER.length) * 100);
  const generatedAt = new Date().toLocaleString('pt-BR');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Participante: ${state.code || 'Não informado'}  ·  Forma: ${state.form}  ·  Conclusão: ${doneCount}/${STAGE_ORDER.length} (${completionPct}%)`,
    margin + 4,
    y + 13.5
  );
  doc.text(
    `Registros: ${state.rows.length} linhas  ·  Emitido em: ${generatedAt}`,
    margin + 4,
    y + 19
  );
  y += 29;

  // Dados contextuais se houver
  const ctxPairs: Array<[string, string]> = [];
  if (state.ctx.idade) ctxPairs.push(['Idade', `${state.ctx.idade} anos`]);
  if (state.ctx.escolaridade) ctxPairs.push(['Escolaridade', `${state.ctx.escolaridade} anos`]);
  if (state.ctx.sono) ctxPairs.push(['Sono (noite anterior)', `${state.ctx.sono} h`]);
  if (state.ctx.subst) ctxPairs.push(['Substâncias hoje', state.ctx.subst]);
  if (state.ctx.med) ctxPairs.push(['Medicação em uso', state.ctx.med]);
  if (state.ctx.dx) ctxPairs.push(['Diagnósticos', state.ctx.dx]);
  if (ctxPairs.length > 0) {
    drawKvGrid(ctxPairs);
  }

  const hasOutOfOrder = Object.keys(state.ooo).some((k) => state.ooo[k as keyof typeof state.ooo]);
  if (hasOutOfOrder) {
    drawNote(
      'Aviso clínico: há fases executadas fora da ordem recomendada do protocolo (marcadas nos dados).',
      [180, 83, 9]
    );
  }
  drawNote(
    'Nota metodológica: não há valores normativos de referência nesta versão; os parâmetros de comparação são o nível de acaso (33%) e o observador ideal bayesiano.'
  );

  // 2D & 2DR
  for (const [key, title] of [
    ['2D', 'Fase 2D: inferência sem pista'],
    ['2DR', 'Reteste da 2D'],
  ] as const) {
    drawSectionTitle(title);
    const d = compute2DReport(state, key);
    if (!d) {
      drawNote('Não realizada ou incompleta (necessárias 120 tentativas).');
    } else {
      drawKvGrid([
        ['Sua acurácia', formatPct(d.acc, 1)],
        ['Ideal (mesma evidência)', formatPct(d.idealAcc, 1)],
        ['Ganha-fica / perde-troca', formatPct(d.wslsAcc, 1)],
        ['Concordância com ideal', formatPct(d.agreement, 1)],
        ['Escolhas figura 2 (lapso)', d.f2Count],
        ['TR mediano', formatMs(d.medianRt)],
      ]);
      await embedChart(`${key}-timeline`, 'Linha do tempo da regra oculta e crença bayesiana');
      await embedChart(`${key}-lag`, 'Acurácia por distância após a troca de regra');
      drawTable(
        ['Tentativas após troca', ...d.labels],
        [
          ['Você', ...d.meByLag.map((v) => formatPct(v))],
          ['Ideal', ...d.idealByLag.map((v) => formatPct(v))],
          ['Confiança média (1–4)', ...d.confByLag.map((v) => formatNum(v, 1))],
        ]
      );
      if (d.fit) {
        drawTable(
          ['Modelo', 'BIC', 'Parâmetros estimados'],
          d.fit.all.map((m) => [m.nome, formatNum(m.bic, 1), m.par])
        );
      }
    }
  }

  // 2C
  drawSectionTitle('Fase 2C: reversão de contingências');
  const d2c = compute2CReport(state);
  if (!d2c) {
    drawNote('Não realizada.');
  } else {
    drawTable(
      ['Reversão', 'Tent. até 4 acertos', 'Outra pista após erro', 'Repetiu antiga', 'TR antes', 'TR depois'],
      d2c.lines
    );
    drawKvGrid([
      ['Erro antes da 1ª reversão', d2c.preRevError],
      ['Sondas invertidas (Losango/Estrela)', d2c.probesInverted],
    ]);
  }

  // 2P
  drawSectionTitle('Fase 2P: pista probabilística');
  const d2p = compute2PReport(state);
  if (!d2p) {
    drawNote('Não realizada.');
  } else {
    drawKvGrid([
      ['Acerto (teto 80%)', d2p.acc],
      ['Seguiu regra mais provável', d2p.mostProbable],
      ['Trocou após exceção isolada', d2p.switchedAfterExc],
      ['Adaptação 1ª reversão', d2p.adapt1],
      ['Adaptação 2ª reversão', d2p.adapt2],
    ]);
  }

  // 2A
  drawSectionTitle('Fase 2A: generalização (carga × instrução)');
  const d2a = compute2AReport(state);
  if (!d2a) {
    drawNote('Não realizada.');
  } else {
    drawKvGrid([
      ['Duração calibrada da pista', d2a.cueMs],
      ['Limiar da escada', d2a.thr],
      ['Reversões na escada', d2a.reversoes],
      ['Lapsos (figura 2)', d2a.lapsos],
    ]);
    drawTable(
      ['Condição', 'Acerto explícita', 'Acerto inferida', 'Custo seleção', 'TR explícita', 'TR inferida'],
      d2a.rows
    );
  }

  // 2B
  drawSectionTitle('Fase 2B: reassociação');
  const d2b = compute2BReport(state);
  if (!d2b) {
    drawNote('Não realizada.');
  } else {
    drawKvGrid([
      ['Acerto nas 10 primeiras', d2b.first10],
      ['1ª ocorrência do 2º símbolo', d2b.secondCueFirst],
      ['Tentativas de aprendizagem', d2b.totalLearn],
      ['Critério', d2b.passed],
      ['Teste, figuras inéditas', d2b.testNovel],
      ['Teste, Lua e Sol', d2b.testOld],
    ]);
  }

  // 3
  drawSectionTitle('Fase 3: blocking com 8 pistas');
  const d3 = compute3Report(state);
  if (!d3) {
    drawNote('Não realizada.');
  } else {
    drawTable(['Pista', 'Escolha esperada', 'Nota (−3 a +3)', 'Reconhecimento'], d3.rows);
    drawKvGrid([
      ['BI (escolha): V − Y', d3.biChoice],
      ['BI (nota): V − Y', d3.biRating],
    ]);
  }

  // 1A e 1B
  for (const s of ['1A', '1B'] as const) {
    drawSectionTitle(`Fase ${s}`);
    const d = computeLearnBlockReport(state, s);
    if (!d) {
      drawNote('Não realizada.');
    } else {
      drawKvGrid([
        ['Critério', d.criterion],
        ['Tentativas', d.trials],
        ['TR mediano (acertos)', d.medianRt],
        ['Erros Repetição / Exclusão', d.errorsAB],
        ['Lapsos (figura 2)', d.lapses],
        ['Omissões', d.omissions],
      ]);
      drawTable(['Bloco', 'Acertos'], d.blocks);
      if (d.checks.length > 0) {
        drawNote(
          'Teste explícito dos símbolos: ' +
            d.checks
              .map(
                (r) =>
                  `${NOME[r.pista || ''] || r.pista} → ${RN[r.resposta as 'A' | 'B']} (${
                    r.acerto ? 'certo' : 'errado'
                  })`
              )
              .join(' · ')
        );
      }
    }
  }

  // Memória e velocidade
  drawSectionTitle('Memória operacional e velocidade de processamento');
  const speedRows = rowsOf(state, 'spd');
  const speedCorrect = speedRows.filter((r) => r.acerto === 1).length;
  const speedRt = median(
    speedRows.filter((r) => (r.tr || 0) >= 150 && r.acerto === 1).map((r) => r.tr as number)
  );
  drawKvGrid([
    ['Blocos de Corsi (maior seq.)', state.res.corsi ? state.res.corsi.span : '–'],
    ['Dígitos inversos (maior seq.)', state.res.dig ? state.res.dig.span : '–'],
    ['Velocidade (acertos em 60 s)', speedRows.length ? speedCorrect : '–'],
    ['Velocidade (TR mediano)', speedRows.length ? formatMs(speedRt) : '–'],
  ]);

  // Rodapé paginado em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Projeto Atenção · Participante ${state.code || 'anon'} · Forma ${state.form}`,
      margin,
      pageH - 8
    );
    doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  doc.save(`atencao_${state.code || 'anon'}_${state.form}.pdf`);
}
