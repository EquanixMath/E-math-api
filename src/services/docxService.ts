import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  ShadingType,
} from 'docx';

import type { ExportPuzzle, ExportRequest } from '../types/export.js';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const OP_ORDER = ['+', '-', '×', '÷', '+/-', '×/÷', '?'];

const TILE_POINTS: Record<string, number> = {
  '0': 1, '1': 1, '2': 1, '3': 1,
  '4': 2, '5': 2, '6': 2, '7': 2, '8': 2, '9': 2,
  '10': 3, '11': 4, '12': 3, '13': 6, '14': 4,
  '15': 4, '16': 4, '17': 6, '18': 4, '19': 7, '20': 5,
  '+': 2, '-': 2, '×': 2, '÷': 2,
  '+/-': 1, '×/÷': 1, '=': 1, '?': 0,
};

const SLOT_LABELS: Record<string, string> = {
  px1: ' ',
  px2: 'P×2',
  px3: 'P×3',
  px3star: '★',
  ex2: 'E×2',
  ex3: 'E×3',
};

// ── Page geometry (A4, twip) ──────────────────
// A4: 11906 × 16838 twip
// Margins: 580 each side → usable width = 10746 twip
// Usable height = 16838 - 580×2 = 15678 twip
//
// Layout per puzzle-pair row:
//   TILE_H (board) + GAP_ROW_H + TILE_H (rack) = 800 twip  → one puzzle block
//   BETWEEN_Q = 202 twip                                     → gap between pairs
//   Total per pair = 800 + 202 = 1002 twip
//
// Header block on page 1 (title + subtitle paragraphs)
// is matched by spacing.before on the FIRST two-col table
// on subsequent pages — no separate spacer element needed.
// Word handles natural page breaks between pair-rows automatically.

const TILE_W    = 360;
const TILE_H    = 360;
const GAP_ROW_H = 80;   // gap between board row and rack row
const BETWEEN_Q = 202;  // gap between puzzle pairs (spacer table row)

// Header spacing replicated as paragraph spacing.before on page-2+ tables
// Title row ≈ 240 twip line + 40 after = 280
// Subtitle row ≈ 200 twip line + 160 after = 360
// Total ≈ 640 twip — replicated via spacing.before on the continuation table
const HEADER_BLOCK_H = 640;

const NUM_W   = 400;
const COL_SEP = 360;

const MARGIN_SIDE = 580;
const MARGIN_TOP  = 580;
const MARGIN_BOT  = 580;

// Font sizes (half-points) — all Arial
const FONT_TILE = 18; // 9 pt
const FONT_NUM  = 13; // 6.5 pt
const FONT_H1   = 24; // 12 pt
const FONT_SUB  = 13; // 6.5 pt

const FONT = 'Arial';

const PAGE_SIZE = 30; // puzzles per page

// ── Page inner width ──────────────────────────
const PAGE_INNER = 11906 - MARGIN_SIDE * 2; // 10746 twip
const COL_W = Math.floor((PAGE_INNER - COL_SEP) / 2); // 5193 twip

// ─────────────────────────────────────────────
// BORDERS
// ─────────────────────────────────────────────

const solid = (size = 4, color = '000000') => ({
  style: BorderStyle.SINGLE, size, color,
});
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

const tileBorder = {
  top: solid(4), bottom: solid(4), left: solid(4), right: solid(4),
};
const noBorders = {
  top: none, bottom: none, left: none, right: none,
  insideH: none, insideV: none,
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function run(
  text: string,
  opts: { bold?: boolean; size?: number } = {},
): TextRun {
  return new TextRun({
    text,
    bold: opts.bold ?? false,
    size: opts.size ?? FONT_TILE,
    font: FONT,
  });
}

function emptyPara(spacing?: { before?: number; after?: number }): Paragraph {
  return new Paragraph({
    spacing: { before: spacing?.before ?? 0, after: spacing?.after ?? 0 },
    children: [],
  });
}

function gapCell(w: number): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: noBorders,
    children: [emptyPara()],
  });
}

// ─────────────────────────────────────────────
// TILE CELL
// ─────────────────────────────────────────────

function tileCell(text: string, isBlank = false): TableCell {
  return new TableCell({
    width: { size: TILE_W, type: WidthType.DXA },
    borders: tileBorder,
    verticalAlign: VerticalAlign.CENTER,
    shading: isBlank
      ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E4E4E4' }
      : { type: ShadingType.CLEAR, color: 'auto', fill: 'FFFFFF' },
    margins: { top: 0, bottom: 0, left: 18, right: 18 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [run(text, { size: FONT_TILE })],
      }),
    ],
  });
}

// ─────────────────────────────────────────────
// TILE ROW TABLE
// ─────────────────────────────────────────────

function tileRow(tokens: string[], blanks: boolean[] = []): Table {
  const tileCount = tokens.length;
  const tileTotal = tileCount * TILE_W;

  return new Table({
    width: { size: tileTotal, type: WidthType.DXA },
    columnWidths: Array(tileCount).fill(TILE_W),
    borders: noBorders,
    rows: [
      new TableRow({
        height: { value: TILE_H, rule: 'exact' as any },
        children: tokens.map((t, i) => tileCell(t, blanks[i] ?? false)),
      }),
    ],
  });
}

// ─────────────────────────────────────────────
// SCORE
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// SORT RACK
// ─────────────────────────────────────────────

function sortRack(tiles: string[]): string[] {
  const normalize = (t: string) => t.trim();

  const getRank = (raw: string) => {
    const t = normalize(raw);
    const n = Number(t);

    if (!isNaN(n)) return { group: 0, value: n };

    if (['+', '-', '×', '÷'].includes(t)) {
      return { group: 1, value: ['+', '-', '×', '÷'].indexOf(t) };
    }

    if (['+/-', '×/÷'].includes(t)) {
      return { group: 2, value: ['+/-', '×/÷'].indexOf(t) };
    }

    if (t === '=') return { group: 3, value: 0 };
    if (t === '?') return { group: 4, value: 0 };

    return { group: 5, value: 0 };
  };

  return [...tiles].sort((a, b) => {
    const ra = getRank(a);
    const rb = getRank(b);

    if (ra.group !== rb.group) return ra.group - rb.group;
    return (ra.value - rb.value) || a.localeCompare(b);
  });
}

// ─────────────────────────────────────────────
// PUZZLE BLOCK
// 3-row inner table (board / gap / rack) with number label
// ─────────────────────────────────────────────

function puzzleBlock(
  index: number,
  boardTokens: string[],
  boardBlanks: boolean[],
  rackTokens: string[],
): Table {
  const boardTable = tileRow(boardTokens, boardBlanks);
  const rackTable  = tileRow(rackTokens);

  const numCell = new TableCell({
    width: { size: NUM_W, type: WidthType.DXA },
    rowSpan: 3,
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [run(`${index + 1}.`, { bold: true, size: FONT_NUM })],
      }),
    ],
  });

  const innerGap = gapCell(100);

  const contentCell = (inner: Table | null): TableCell =>
    new TableCell({
      borders: noBorders,
      children: inner ? [inner] : [emptyPara()],
    });

  return new Table({
    width: { size: 0, type: WidthType.AUTO },
    borders: noBorders,
    rows: [
      new TableRow({
        height: { value: TILE_H, rule: 'exact' as any },
        children: [numCell, innerGap, contentCell(boardTable)],
      }),
      new TableRow({
        height: { value: GAP_ROW_H, rule: 'exact' as any },
        children: [innerGap, contentCell(null)],
      }),
      new TableRow({
        height: { value: TILE_H, rule: 'exact' as any },
        children: [innerGap, contentCell(rackTable)],
      }),
    ],
  });
}

// ─────────────────────────────────────────────
// TWO-COLUMN TABLE
// Contains all puzzles in a page-chunk.
// spacingBefore: applied to the first paragraph-level container
// to replicate header height on pages 2+ without a separate
// spacer element that could cause layout issues.
// ─────────────────────────────────────────────

function buildTwoColTable(
  puzzleBlocks: Table[],
  spacingBefore = 0,
): Table {
  const rows: TableRow[] = [];

  const sepBorders = {
    top: none, bottom: none, right: none,
    left: solid(5, 'CCCCCC'),
    insideH: none, insideV: none,
  };

  for (let i = 0; i < puzzleBlocks.length; i += 2) {
    const left  = puzzleBlocks[i];
    const right = puzzleBlocks[i + 1] ?? null;

    // Content row — left puzzle | separator | right puzzle
    rows.push(new TableRow({
      children: [
        new TableCell({
          width: { size: COL_W, type: WidthType.DXA },
          borders: noBorders,
          // Apply spacingBefore only to the very first content row via cell paragraph
          margins: i === 0 ? { top: spacingBefore } : undefined,
          children: [left],
        }),
        new TableCell({
          width: { size: COL_SEP, type: WidthType.DXA },
          borders: sepBorders,
          children: [emptyPara()],
        }),
        new TableCell({
          width: { size: COL_W, type: WidthType.DXA },
          borders: noBorders,
          margins: i === 0 ? { top: spacingBefore } : undefined,
          children: right ? [right] : [emptyPara()],
        }),
      ],
    }));

    // Gap row between puzzle pairs
    rows.push(new TableRow({
      height: { value: BETWEEN_Q, rule: 'exact' as any },
      children: [
        new TableCell({ width: { size: COL_W,    type: WidthType.DXA }, borders: noBorders, children: [emptyPara()] }),
        new TableCell({ width: { size: COL_SEP,  type: WidthType.DXA }, borders: noBorders, children: [emptyPara()] }),
        new TableCell({ width: { size: COL_W,    type: WidthType.DXA }, borders: noBorders, children: [emptyPara()] }),
      ],
    }));
  }

  return new Table({
    width: { size: PAGE_INNER, type: WidthType.DXA },
    columnWidths: [COL_W, COL_SEP, COL_W],
    borders: noBorders,
    rows,
  });
}

// ─────────────────────────────────────────────
// ANSWER KEY SECTION
// ─────────────────────────────────────────────

function buildAnswerKeySection(puzzles: ExportPuzzle[]): (Paragraph | Table)[] {
  const items = puzzles.map((p, i) => {
    const hasBonus = p.boardSlots?.some(s => !s.isLocked && s.slotType && s.slotType !== 'px1') ?? false;
    const score = hasBonus ? computeSolutionScore(p) : null;
    const scoreStr = score != null ? ` (${score} pts)` : '';
    return `${i + 1}. ${p.equation ?? '—'}${scoreStr}`;
  });

  const mid = Math.ceil(items.length / 2);
  const leftItems  = items.slice(0, mid);
  const rightItems = items.slice(mid);
  const rowCount   = Math.max(leftItems.length, rightItems.length);

  const solRows: TableRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    solRows.push(new TableRow({
      children: [
        new TableCell({
          width: { size: COL_W, type: WidthType.DXA },
          borders: noBorders,
          children: [new Paragraph({
            spacing: { before: 0, after: 30 },
            children: [run(leftItems[i] ?? '', { size: FONT_SUB })],
          })],
        }),
        new TableCell({
          width: { size: COL_SEP, type: WidthType.DXA },
          borders: noBorders,
          children: [emptyPara()],
        }),
        new TableCell({
          width: { size: COL_W, type: WidthType.DXA },
          borders: noBorders,
          children: [new Paragraph({
            spacing: { before: 0, after: 30 },
            children: [run(rightItems[i] ?? '', { size: FONT_SUB })],
          })],
        }),
      ],
    }));
  }

  return [
    new Paragraph({
      pageBreakBefore: true,
      spacing: { before: 0, after: 40 },
      children: [run('Answer Key', { bold: true, size: FONT_H1 })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [run(`${puzzles.length} Questions`, { size: FONT_SUB })],
    }),
    new Table({
      width: { size: PAGE_INNER, type: WidthType.DXA },
      columnWidths: [COL_W, COL_SEP, COL_W],
      borders: noBorders,
      rows: solRows,
    }),
  ];
}

// ─────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────

export async function generateDocx({
  title,
  puzzles,
  withSolution = false,
  subtitlePrefix = 'Bingo Generator',
}: ExportRequest): Promise<Buffer> {

  // ── Build all puzzle blocks ──────────────────
  const allBlocks: Table[] = puzzles.map((p, i) => {
    const boardTokens = p.boardSlots.map(s =>
      s.isLocked
        ? (s.resolvedValue ?? s.tile ?? '')
        : (SLOT_LABELS[s.slotType ?? 'px1'] ?? ' '),
    );
    const boardBlanks = p.boardSlots.map(s => !s.isLocked);
    const rackTokens  = sortRack(p.rackTiles);
    return puzzleBlock(i, boardTokens, boardBlanks, rackTokens);
  });

  // ── Chunk into pages ─────────────────────────
  const chunks: Table[][] = [];
  for (let i = 0; i < allBlocks.length; i += PAGE_SIZE) {
    chunks.push(allBlocks.slice(i, i + PAGE_SIZE));
  }
  if (chunks.length === 0) chunks.push([]);

  // ── Build a SINGLE section with all content ──
  // This avoids phantom blank pages caused by Word inserting
  // mandatory page breaks between sections.
  //
  // Pages 2+ naturally start because 30 puzzles fill a page exactly.
  // We replicate the header's vertical space via `spacingBefore` on
  // the two-col table's first row cells — no separate spacer element.
  const sectionChildren: (Paragraph | Table)[] = [];

  chunks.forEach((chunk, pageIdx) => {
    const isFirstPage = pageIdx === 0;
    const isLastPage  = pageIdx === chunks.length - 1;

    if (isFirstPage) {
      // Real title + subtitle paragraphs
      sectionChildren.push(
        new Paragraph({
          spacing: { before: 0, after: 40 },
          children: [run(title, { bold: true, size: FONT_H1 })],
        }),
        new Paragraph({
          spacing: { before: 0, after: 160 },
          children: [run(`${subtitlePrefix}  ·  ${puzzles.length} Questions`, { size: FONT_SUB })],
        }),
      );
      sectionChildren.push(buildTwoColTable(chunk, 0));
    } else {
      // Pages 2+: no separate spacer table/paragraph.
      // The two-col table carries `spacingBefore` via cell top margin
      // to push content down by the same amount as the header block.
      sectionChildren.push(buildTwoColTable(chunk, HEADER_BLOCK_H));
    }

    if (withSolution && isLastPage) {
      for (const node of buildAnswerKeySection(puzzles)) {
        sectionChildren.push(node);
      }
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top:    MARGIN_TOP,
              bottom: MARGIN_BOT,
              left:   MARGIN_SIDE,
              right:  MARGIN_SIDE,
            },
          },
        },
        children: sectionChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}