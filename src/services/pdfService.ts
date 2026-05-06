import puppeteer, { type Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { ExportPuzzle, ExportRequest } from '../types/export.js';

// ─── TOKEN POINTS (mirrors amathTokens.ts in frontend) ───────────────────────
const TILE_POINTS: Record<string, number> = {
  '0': 1, '1': 1, '2': 1, '3': 1,
  '4': 2, '5': 2, '6': 2, '7': 2, '8': 2, '9': 2,
  '10': 3, '11': 4, '12': 3, '13': 6, '14': 4,
  '15': 4, '16': 4, '17': 6, '18': 4, '19': 7, '20': 5,
  '+': 2, '-': 2, '×': 2, '÷': 2,
  '+/-': 1, '×/÷': 1, '=': 1, '?': 0,
};

// ─── BROWSER SINGLETON + CONCURRENCY LIMITER ─────────────────────────────────
// Reuse one browser across requests (avoid cold-start per request).
// Limit concurrent PDF renders to avoid OOM on the Puppeteer process.
const MAX_CONCURRENT = 3;
let activeRenders = 0;
const renderQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT) {
    activeRenders++;
    return Promise.resolve();
  }
  return new Promise(resolve => renderQueue.push(resolve));
}

function releaseSlot(): void {
  const next = renderQueue.shift();
  if (next) {
    next(); // pass slot directly to next waiter
  } else {
    activeRenders--;
  }
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  return browserInstance;
}

// ─── HELPERS (mirrors PuzzlePdfGenerator.jsx) ─────────────────────────────────
const OP_ORDER = ['+', '-', '×', '÷', '+/-', '×/÷', '?'];

function sortRack(tiles: string[]): string[] {
  return [...tiles].sort((a, b) => {
    const an = parseFloat(a), bn = parseFloat(b);
    const aNum = !isNaN(an), bNum = !isNaN(bn);
    if (aNum && bNum) return an - bn;
    if (aNum) return -1;
    if (bNum) return 1;
    if (a === '=') return -1;
    if (b === '=') return 1;
    return OP_ORDER.indexOf(a) - OP_ORDER.indexOf(b);
  });
}

function computeSolutionScore(puzzle: ExportPuzzle): number | null {
  if (!puzzle.solutionTiles || !puzzle.boardSlots) return null;
  let letterTotal = 0, wordMult = 1;
  for (let i = 0; i < puzzle.boardSlots.length; i++) {
    const tile = puzzle.solutionTiles[i];
    const pts = TILE_POINTS[tile] ?? 0;
    const st = puzzle.boardSlots[i].isLocked
      ? 'px1'
      : (puzzle.boardSlots[i].slotType ?? 'px1');
    if (st === 'px2') letterTotal += pts * 2;
    else if (st === 'px3' || st === 'px3star') letterTotal += pts * 3;
    else letterTotal += pts;
    if (st === 'ex2') wordMult *= 2;
    if (st === 'ex3') wordMult *= 3;
  }
  return letterTotal * wordMult + 40;
}

// ─── HTML BUILDER (exact port of PuzzlePdfGenerator.jsx buildPrintHtml) ──────
function buildPrintHtml({ puzzles, title, withSolution = true, subtitlePrefix = 'Bingo Generator' }: {
  puzzles: ExportPuzzle[];
  title: string;
  withSolution?: boolean;
  subtitlePrefix?: string;
}): string {
  const PAGE_SIZE = 20;
  const PER_COL = 10;
  const SOL_PER_PAGE = 100;
  let pageCounter = 1;

  const SLOT_LABELS: Record<string, string> = {
    px1: '', px2: 'P×2', px3: 'P×3', px3star: '★', ex2: 'E×2', ex3: 'E×3',
  };

  const renderTileInner = (value: string): string => {
    const pt = TILE_POINTS[value];
    const ptBadge = pt != null ? `<span class="tp">${pt}</span>` : '';
    return `<span class="tv">${escapeHtml(value)}</span>${ptBadge}`;
  };

  const makePuzzleBlock = (p: ExportPuzzle, i: number): string => {
    const tileCount = Math.max(p.boardSlots.length, p.rackTiles.length);
    const sizeClass = tileCount <= 12 ? 'sz-lg' : 'sz-sm';
    const hasBonus = p.boardSlots.some(s => !s.isLocked && s.slotType && s.slotType !== 'px1');

    const board = p.boardSlots.map(s => {
      if (s.isLocked) {
        return `<span class="tile locked ${sizeClass}">${renderTileInner(s.resolvedValue ?? s.tile ?? '')}</span>`;
      }
      const st = s.slotType ?? 'px1';
      const label = SLOT_LABELS[st] ?? '';
      const specialClass = st !== 'px1' ? ' special' : '';
      return `<span class="tile empty${specialClass} ${sizeClass}">${label ? `<span class="sl">${label}</span>` : ''}</span>`;
    }).join('');

    const rack = sortRack(p.rackTiles)
      .map(t => `<span class="tile rack ${sizeClass}">${renderTileInner(t)}</span>`)
      .join('');

    return `
<div class="q">
  <div class="qnum">${i + 1}</div>
  <div class="qbody">
    <div class="row"><span class="rlabel">B</span><div class="tiles">${board}</div></div>
    <div class="row"><span class="rlabel">R</span><div class="tiles">${rack}</div></div>
    ${hasBonus ? '<div class="ans">Pts: ________</div>' : ''}
  </div>
</div>`;
  };

  // Question pages
  const questionPages: ExportPuzzle[][] = [];
  for (let i = 0; i < puzzles.length; i += PAGE_SIZE) {
    questionPages.push(puzzles.slice(i, i + PAGE_SIZE));
  }

  const questionHtml = questionPages.map((page, pi) => {
    const left = page.slice(0, PER_COL);
    const right = page.slice(PER_COL, PAGE_SIZE);
    const offset = pi * PAGE_SIZE;
    const leftHtml = left.map((p, i) => makePuzzleBlock(p, offset + i)).join('');
    const rightHtml = right.map((p, i) => makePuzzleBlock(p, offset + PER_COL + i)).join('');
    const isFirst = pi === 0;

    return `
<div class="page${pi !== 0 ? ' page-break' : ''}">
  ${isFirst ? `
  <div class="header">
    <div class="header-left">
      <div class="title">${escapeHtml(title)}</div>
      <div class="subtitle">${escapeHtml(subtitlePrefix)} · ${puzzles.length} Questions</div>
    </div>
    <div class="header-right">
      <div class="field">Name: ______________________</div>
      <div class="field">Date: _____ / _____ / _____</div>
    </div>
  </div>` : `
  <div class="header">
    <div class="header-left">
      <div class="title-cont">${escapeHtml(title)}</div>
      <div class="subtitle">Page ${pi + 1} of ${questionPages.length}</div>
    </div>
    <div class="header-right">
      <div class="field">Name: ______________________</div>
      <div class="field">Date: _____ / _____ / _____</div>
    </div>
  </div>`}
  <div class="rule"></div>
  <div class="grid">
    <div class="col">${leftHtml}</div>
    <div class="col-sep"></div>
    <div class="col">${rightHtml}</div>
  </div>
  <div class="pagenum">— ${pageCounter++} —</div>
</div>`;
  }).join('');

  // Solution pages (only when withSolution is true)
  let solutionHtml = '';
  if (withSolution) {
    const solutionPages: ExportPuzzle[][] = [];
    for (let i = 0; i < puzzles.length; i += SOL_PER_PAGE) {
      solutionPages.push(puzzles.slice(i, i + SOL_PER_PAGE));
    }
    solutionHtml = solutionPages.map((page, pi) => {
      const items = page.map((p, i) => {
        const idx = pi * SOL_PER_PAGE + i + 1;
        const hasBonus = p.boardSlots?.some(s => !s.isLocked && s.slotType && s.slotType !== 'px1') ?? false;
        const score = hasBonus ? computeSolutionScore(p) : null;
        const scoreStr = score != null ? ` (${score}pts)` : '';
        return `<div class="sol-item"><span class="sol-num">${idx}.</span> ${escapeHtml(p.equation ?? '—')}${scoreStr}</div>`;
      }).join('');
      return `
<div class="page page-break">
  <div class="header">
    <div class="header-left">
      <div class="title">Answer Key</div>
      <div class="subtitle">${escapeHtml(title)}</div>
    </div>
    <div class="header-right"></div>
  </div>
  <div class="rule"></div>
  <div class="sol-grid">${items}</div>
  <div class="pagenum">— ${pageCounter++} —</div>
</div>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: 8mm 10mm 10mm 10mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Courier New', Courier, monospace; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 190mm; height: 275mm; position: relative; overflow: hidden; }
.page-break { page-break-before: always; }
.header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 1.5mm; }
.title { font-size: 14px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
.title-cont { font-size: 12px; font-weight: 700; }
.subtitle { font-size: 8px; color: #555; margin-top: 1px; letter-spacing: 1px; }
.header-right { text-align: right; }
.field { font-size: 8px; color: #333; margin-bottom: 1px; }
.rule { border-top: 1.5px solid #000; margin-bottom: 2mm; }
.grid { display: flex; gap: 0; height: 256mm; }
.col { flex: 1; display: flex; flex-direction: column; }
.col-sep { width: 0; border-left: 0.5px solid #ccc; margin: 0 2.5mm; }
.q { display: flex; gap: 1.5mm; border-bottom: 0.5px solid #ddd; flex: 1; align-items: center; }
.q:last-child { border-bottom: none; }
.qnum { width: 16px; font-size: 11px; font-weight: 900; text-align: right; color: #000; flex-shrink: 0; }
.qbody { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.row { display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; }
.rlabel { font-size: 7px; font-weight: 700; color: #999; width: 8px; text-align: center; flex-shrink: 0; }
.tiles { display: flex; gap: 1.5px; flex-wrap: nowrap; }
.tile.sz-lg { width: 24px; height: 24px; }
.tile.sz-lg .tv { font-size: 11px; }
.tile.sz-lg .tp { font-size: 5.5px; }
.tile.sz-lg .sl { font-size: 6px; }
.tile.sz-sm { width: 18px; height: 18px; }
.tile.sz-sm .tv { font-size: 9px; }
.tile.sz-sm .tp { font-size: 4.5px; }
.tile.sz-sm .sl { font-size: 5px; }
.tile { display: inline-flex; align-items: center; justify-content: center; position: relative; line-height: 1; flex-shrink: 0; }
.tile.locked { border: 1.5px solid #000; background: #e0e0e0; }
.tile.empty { border: 1px dashed #aaa; background: #fff; }
.tile.empty.special { border: 1.5px dashed #555; }
.tile.rack { border: 1px solid #888; background: #fff; }
.tv { font-weight: 800; }
.tp { position: absolute; bottom: 0px; right: 1px; font-weight: 700; color: #777; }
.sl { font-weight: 700; color: #666; }
.ans { font-size: 7px; color: #999; margin-left: 10px; margin-top: 10px; letter-spacing: 0.5px; }
.pagenum { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #999; }
.sol-grid { columns: 2; column-gap: 8mm; font-size: 9px; line-height: 1.8; }
.sol-item { break-inside: avoid; }
.sol-num { display: inline-block; width: 24px; text-align: right; font-weight: 700; margin-right: 4px; }
</style>
</head>
<body>
${questionHtml}
${solutionHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export async function generatePdf({ title, puzzles, withSolution, subtitlePrefix }: ExportRequest): Promise<Buffer> {
  const html = buildPrintHtml({ puzzles, title, withSolution, subtitlePrefix });

  await acquireSlot();
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
    releaseSlot();
  }
}
