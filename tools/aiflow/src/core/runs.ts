import fs from 'fs-extra';
import path from 'path';
import { StageFile } from '../types.js';

export type RunSummary = {
  request_id: string;
  run_id: string;
  status: 'running' | 'done' | 'needs_input' | 'failed';
  started_at: string | null;
  updated_at: string | null;
  paths: {
    stage: string;
    context?: string;
    errors?: string;
    report?: string;
  };
  compare_url?: string | null;
};

export async function loadStage(stagePath: string): Promise<StageFile | null> {
  if (!(await fs.pathExists(stagePath))) return null;
  try {
    return await fs.readJSON(stagePath);
  } catch {
    return null;
  }
}

function toStatus(stage?: StageFile | null): RunSummary['status'] {
  if (!stage) return 'failed';
  if (stage.state === 'DONE') return 'done';
  if (stage.state === 'NEEDS_INPUT') return 'needs_input';
  if (stage.state === 'FAILED') return 'failed';
  return 'running';
}

export async function listRunsForRequest(runsDir: string, requestId: string): Promise<RunSummary[]> {
  const baseDir = path.join(runsDir, requestId);
  if (!(await fs.pathExists(baseDir))) return [];
  const runIds = await fs.readdir(baseDir);
  const summaries: RunSummary[] = [];
  for (const runId of runIds) {
    const stagePath = path.join(baseDir, runId, 'stage.json');
    const stage = await loadStage(stagePath);
    summaries.push({
      request_id: requestId,
      run_id: runId,
      status: toStatus(stage),
      started_at: stage?.started_at || null,
      updated_at: stage?.updated_at || null,
      paths: {
        stage: stagePath,
        errors: path.join(baseDir, runId, 'errors.json'),
        report: path.join(baseDir, runId, 'report.md')
      },
      compare_url: stage?.artifacts.compare_url || null
    });
  }
  summaries.sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  return summaries;
}

export async function latestRun(runsDir: string, requestId: string): Promise<RunSummary | null> {
  const runs = await listRunsForRequest(runsDir, requestId);
  return runs[0] || null;
}
