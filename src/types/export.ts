export interface BoardSlot {
  tile: string | null;
  isLocked: boolean;
  slotType?: string;       // 'px1' | 'px2' | 'px3' | 'px3star' | 'ex2' | 'ex3'
  resolvedValue?: string;  // locked tile display override
}

export interface ExportPuzzle {
  boardSlots: BoardSlot[];
  rackTiles: string[];
  equation?: string;       // solution equation (used in answer key)
  solutionTiles?: string[]; // tile value per board slot position (for scoring)
  noBonus?: boolean;
}

export interface ExportRequest {
  title: string;
  puzzles: ExportPuzzle[];
  withSolution?: boolean;
  subtitlePrefix?: string;
}
