import fs from 'fs-extra';
import path from 'path';
import { AiflowConfig } from './config.js';
import { StageFile, StagePhase, StageState, StepState, ErrorObject } from '../types.js';

function isoNow() {
  return new Date().toISOString();
}

export function buildInitialSteps(): StepState[] {
  const unit: StepState['test']['unit'] = {
    status: 'NOT_RUN',
    command: null,
    log_path: null,
    duration_ms: null,
    failed_summary: null
  };
  const e2e: StepState['test']['e2e'] = { ...unit };
  return [
    {
      step_id: 'S01',
      title: 'Planning and patch generation',
      role: 'implementer',
      status: 'PENDING',
      started_at: null,
      ended_at: null,
      attempt: 0,
      summary: 'Not started',
      logs: [],
      patch_path: null,
      diff_stat: { files_changed: 0, lines_added: 0, lines_deleted: 0, too_large: false },
      test: { unit, e2e },
      error: null
    }
  ];
}

export function createStage(requestId: string, runId: string, config: AiflowConfig, planningPath: string | null): StageFile {
  const locksDir = config.paths.locks_dir || path.join(config.paths.aiflow_dir || '.aiflow', 'locks');
  const lockPath = path.join(locksDir, `${requestId}.lock`);
  const now = isoNow();
  const runsDir = config.paths.runs_dir;
  const runBase = path.join(runsDir, requestId, runId);
  return {
    version: '1.0',
    request_id: requestId,
    run_id: runId,
    state: 'RUNNING',
    stage: 'INIT',
    title: 'Initializing',
    started_at: now,
    updated_at: now,
    ended_at: null,
    progress: { percent: 0, message: 'starting', eta_sec: null },
    current_step_index: 0,
    steps: buildInitialSteps(),
    locks: {
      request_lock: { path: lockPath, held: false, acquired_at: null, ttl_sec: config.runner?.lock_ttl_sec || 900 },
      queue_lock: { path: path.join(locksDir, 'queue.lock'), held: false, acquired_at: null, ttl_sec: config.runner?.lock_ttl_sec || 900 }
    },
    artifacts: {
      request_path: path.relative(process.cwd(), path.join(config.paths.requests_dir, `${requestId}.md`)),
      planning_json: planningPath ? path.relative(process.cwd(), planningPath) : null,
      report_md: path.relative(process.cwd(), path.join(runBase, 'report.md')),
      errors_json: null,
      patches: [],
      logs_dir: path.relative(process.cwd(), path.join(runBase, 'logs')),
      compare_url: null
    },
    error: null,
    counters: {
      planner_calls: 0,
      implementer_calls: 0,
      qa_calls: 0,
      unit_runs: 0,
      e2e_runs: 0,
      autofix_cycles: 0,
      retries: 0
    },
    signals: { stop_requested: false, resume_requested: false, notes: null }
  };
}

export async function writeStage(filePath: string, stage: StageFile): Promise<void> {
  stage.updated_at = isoNow();
  await fs.writeJson(filePath, stage, { spaces: 2 });
}

export function setStage(stage: StageFile, state: StageState, phase: StagePhase, title: string, message: string, percent: number) {
  stage.state = state;
  stage.stage = phase;
  stage.title = title;
  stage.progress = { percent, message, eta_sec: null };
  stage.updated_at = isoNow();
}

export function setError(stage: StageFile, error: ErrorObject) {
  stage.error = error;
}
