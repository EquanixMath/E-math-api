import type { Request, Response } from 'express';
import { generatePdf } from '../services/pdfService.js';
import { generateDocx } from '../services/docxService.js';
import type { ExportRequest } from '../types/export.js';

const MAX_PUZZLES = 1200;

function validateBody(body: any): body is ExportRequest {
  return (
    typeof body.title === 'string' &&
    Array.isArray(body.puzzles) &&
    body.puzzles.length > 0 &&
    body.puzzles.length <= MAX_PUZZLES
  );
}

export async function exportPdf(req: Request, res: Response): Promise<void> {
  if (!validateBody(req.body)) {
    res.status(400).json({ message: 'Invalid request: title and puzzles[] are required' });
    return;
  }

  const { title, puzzles, withSolution } = req.body as ExportRequest;

  try {
    const buffer = await generatePdf({ title, puzzles, withSolution });
    const filename = `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err: any) {
    console.error('[exportPdf] error:', err);
    res.status(500).json({ message: 'PDF generation failed', detail: err.message });
  }
}

export async function exportDocx(req: Request, res: Response): Promise<void> {
  if (!validateBody(req.body)) {
    res.status(400).json({ message: 'Invalid request: title and puzzles[] are required' });
    return;
  }

  const { title, puzzles, withSolution } = req.body as ExportRequest;

  try {
    const buffer = await generateDocx({ title, puzzles, withSolution });
    const filename = `${title.replace(/[^a-z0-9]/gi, '_')}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err: any) {
    console.error('[exportDocx] error:', err);
    res.status(500).json({ message: 'DOCX generation failed', detail: err.message });
  }
}
