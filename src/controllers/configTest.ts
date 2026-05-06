import type { Request, Response } from 'express';
import ConfigTestResult from '../models/ConfigTestResult.js';

/** GET /config-tests — get all test results */
export async function getConfigTestResults(req: Request, res: Response) {
  try {
    const results = await ConfigTestResult.find({})
      .sort({ configCategory: 1, configId: 1 })
      .lean();

    res.json({
      results: results.map(r => ({
        id: (r._id as any).toString(),
        configId: r.configId,
        configLabel: r.configLabel,
        configCategory: r.configCategory,
        configSpec: r.configSpec,
        mode: r.mode,
        totalTile: r.totalTile,
        status: r.status,
        successCount: r.successCount,
        failCount: r.failCount,
        attemptsCount: r.attemptsCount,
        examples: r.examples,
        avgMs: r.avgMs,
        errorMessage: r.errorMessage,
        testedAt: r.testedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

/** POST /config-tests/batch — upsert batch of test results */
export async function saveConfigTestResults(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const { results } = req.body;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ message: 'results must be a non-empty array' });
    }

    const ops = results.map((r: any) => ({
      updateOne: {
        filter: { configId: r.configId },
        update: {
          $set: {
            configId: r.configId,
            configLabel: r.configLabel,
            configCategory: r.configCategory ?? 'misc',
            configSpec: r.configSpec,
            mode: r.mode ?? 'cross',
            totalTile: r.totalTile,
            status: r.status,
            successCount: r.successCount ?? 0,
            failCount: r.failCount ?? 0,
            attemptsCount: r.attemptsCount ?? 0,
            examples: (r.examples ?? []).slice(0, 10),
            avgMs: r.avgMs ?? 0,
            errorMessage: r.errorMessage ?? undefined,
            testedAt: new Date(),
            ...(userId ? { testedBy: userId } : {}),
          },
        },
        upsert: true,
      },
    }));

    await ConfigTestResult.bulkWrite(ops);

    res.json({ message: 'Saved', count: results.length });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

/** DELETE /config-tests — clear all results */
export async function clearConfigTestResults(req: Request, res: Response) {
  try {
    const { count } = await ConfigTestResult.deleteMany({});
    res.json({ message: 'Cleared', count });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
