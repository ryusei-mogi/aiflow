import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { AiflowConfig } from './config.js';
import { ParsedRequest, PlanningFile, RunnerResult, StageFile, ErrorObject } from '../types.js';
import { parseRequest } from './meta.js';
import { createStage, setError, setStage, writeStage } from './stage.js';
import fg from 'fast-glob';
import { evaluateQualityGates } from './qualityGates.js';
import { loadRouter } from './config.js';
import { callLlm } from './router.js';
import { validateIfExists, validateSchemaFile } from './validate.js';
import chalk from 'chalk';

const execAsync = util.promisify(exec);

function isoNow() {
  return new Date().toISOString();
}

export function makeRunId() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `RUN-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${Math.random().toString(16).slice(2, 8)}`;
}

async function acquireLock(lockPath: string, runId: string): Promise<boolean> {
  try {
    await fs.writeFile(lockPath, runId, { flag: 'wx' });
    return true;
  } catch (e) {
    return false;
  }
}

async function releaseLock(lockPath: string) {
  if (await fs.pathExists(lockPath)) {
    await fs.remove(lockPath);
  }
}

function buildPlanning(request: ParsedRequest, runId: string, config: AiflowConfig, patchPath: string, logPrefix: string): PlanningFile {
  const acceptance = [
    { id: 'AC-01', given: 'request present', when: 'run executed', then: 'planning.json is generated', type: 'functional' },
    { id: 'AC-02', given: 'implementer step', when: 'patch generated', then: 'patch file exists', type: 'functional' },
    { id: 'AC-03', given: 'tests configured', when: 'unit executed', then: 'logs saved', type: 'functional' }
  ];
  return {
    version: '1.0',
    request_id: request.id,
    run_id: runId,
    created_at: isoNow(),
    base_branch: config.repo?.base_branch || 'main',
    work_branch: `${config.git?.branch_prefix || 'ai/'}${request.id}/${runId}`.slice(0, config.git?.max_branch_len || 128),
    limits: {
      max_diff_lines: config.planning?.default_limits?.max_diff_lines || 300,
      max_files_changed: config.planning?.default_limits?.max_files || 10,
      timeout_sec: 180,
      max_steps_per_run: 1,
      max_autofix_cycles: 1
    },
    context: {
      summary: request.title,
      constraints: ['local_only', 'no_gh', 'git_ok'],
      acceptance_criteria: acceptance,
      test_instructions: {
        unit: config.tests?.unit?.command || 'echo "no unit tests configured"',
        e2e: config.tests?.e2e?.command || ''
      }
    },
    gates: {
      require_clean_worktree: config.repo?.require_clean_worktree ?? true,
      require_work_branch: config.repo?.enforce_work_branch ?? false,
      require_unit_pass: true,
      require_e2e_for_regression_ac: false,
      forbid_gh: true,
      max_step_too_large_retries: 1
    },
    steps: [
      {
        step_id: 'S01',
        title: 'Generate patch and log results',
        role: 'implementer',
        intent: 'Produce placeholder patch and run tests',
        scope: {
          target_paths: ['runs', 'requests', 'tools/aiflow'],
          forbidden_paths: ['node_modules', 'vendor'],
          max_diff_lines: config.planning?.default_limits?.max_diff_lines || 300,
          max_files_changed: config.planning?.default_limits?.max_files || 10
        },
        inputs: {
          request_path: request.path,
          context_files: ['.aiflow/config.v1.json', '.aiflow/router.v1.json'],
          code_files_hint: []
        },
        commands: {
          unit: config.tests?.unit?.enabled ? [config.tests?.unit?.command || 'echo "no unit tests"'] : [],
          e2e: config.tests?.e2e?.enabled ? [config.tests?.e2e?.command || 'echo "e2e disabled"'] : []
        },
        success_criteria: ['S01.patch exists', 'Patch applied or file created', 'Unit test command executed'],
        links_to_ac: ['AC-02', 'AC-03'],
        expected_diff: { lines_max: config.planning?.default_limits?.max_diff_lines || 300, files_max: 5, risk_level: 'low' },
        outputs: {
          patch_path: patchPath,
          log_prefix: logPrefix
        }
      }
    ],
    outputs: {
      planning_json: path.join(config.paths.runs_dir, request.id, runId, 'planning.json'),
      stage_json: path.join(config.paths.runs_dir, request.id, runId, 'stage.json'),
      report_md: path.join(config.paths.runs_dir, request.id, runId, 'report.md'),
      errors_json: path.join(config.paths.runs_dir, request.id, runId, 'errors.json')
    },
    assumptions: ['placeholder planning generated locally'],
    risks: ['limited automation in MVP']
  };
}

async function writePlanning(filePath: string, planning: PlanningFile) {
  await fs.writeJson(filePath, planning, { spaces: 2 });
}

async function execCommand(command: string, cwd: string, timeoutMs?: number) {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: timeoutMs });
    return { code: 0, stdout, stderr };
  } catch (e: any) {
    return { code: e.code ?? 1, stdout: e.stdout || '', stderr: e.stderr || e.message };
  }
}

function makeError(reason_code: string, message: string, category: ErrorObject['category'] = 'EXECUTION'): ErrorObject {
  return {
    category,
    reason_code,
    title: reason_code,
    message,
    severity: 'Major',
    retryable: false,
    actions: ['See logs in runs/.../logs', 'Fix the issue and rerun']
  };
}

async function generatePatch(runDir: string, requestId: string, runId: string) {
  const artifactsDir = path.join(runDir, 'artifacts');
  await fs.ensureDir(artifactsDir);
  const targetPath = path.join('runs', requestId, runId, 'artifacts', 'placeholder.txt');
  const content = `Run ${runId} placeholder patch generated at ${isoNow()}\n`;
  const patch = [
    `--- /dev/null`,
    `+++ b/${targetPath}`,
    '@@',
    `+${content}`
  ].join('\n');
  await fs.writeFile(path.join(artifactsDir, 'placeholder.txt'), content, 'utf-8');
  return { patchContent: patch, targetPath };
}

async function readPrompt(name: string): Promise<string> {
  const localPath = path.resolve('.aiflow/prompts', name);
  if (await fs.pathExists(localPath)) return fs.readFile(localPath, 'utf-8');
  return '';
}

function fill(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }
  return out;
}

async function applyPatch(patchPath: string, root: string): Promise<{ ok: boolean; output: string }>
{
  try {
    const { stdout, stderr } = await execAsync(`git apply --whitespace=nowarn ${patchPath}`, { cwd: root });
    return { ok: true, output: (stdout || '') + (stderr || '') };
  } catch (e: any) {
    // fallback: ignore if git repo missing
    return { ok: false, output: e.stderr || e.message };
  }
}

async function checkGhDependency(root: string): Promise<boolean> {
  const entries = await fg(['**/*.{ts,js,tsx,jsx}', '**/*.md'], {
    cwd: root,
    ignore: ['node_modules', 'runs', '.aiflow', '.git']
  });
  for (const file of entries) {
    const content = await fs.readFile(path.join(root, file), 'utf-8');
    if (content.match(/\bgh\b/)) return false;
  }
  return true;
}

async function writeReport(reportPath: string, request: ParsedRequest, runId: string, unitLogPath: string | null, status: string, error?: ErrorObject) {
  const lines: string[] = [];
  lines.push(`# Run Report`);
  lines.push('');
  lines.push(`- Request: ${request.id}`);
  lines.push(`- Run: ${runId}`);
  lines.push(`- Status: ${status}`);
  lines.push('');
  if (error) {
    lines.push(`## Error`);
    lines.push(`- reason_code: ${error.reason_code}`);
    lines.push(`- message: ${error.message}`);
    lines.push('');
  }
  lines.push('## Summary');
  lines.push('- Generated planning and placeholder patch.');
  lines.push('- Executed unit command.');
  if (unitLogPath) lines.push(`- Unit log: ${unitLogPath}`);
  await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');
}

async function writeErrors(errorsPath: string, error: ErrorObject) {
  const payload = {
    version: '1.0',
    error
  };
  await fs.writeJson(errorsPath, payload, { spaces: 2 });
}

async function writeQualityContext(contextPath: string, request: ParsedRequest, runId: string) {
  const payload = {
    version: '1.0',
    request: {
      id: request.id,
      meta: request.meta
    },
    run: {
      run_id: runId,
      started_at: isoNow()
    }
  };
  await fs.writeJson(contextPath, payload, { spaces: 2 });
}

export async function runRequest(requestId: string, config: AiflowConfig, runIdOverride?: string): Promise<RunnerResult> {
  const requestPath = path.join(config.paths.requests_dir, `${requestId}.md`);
  if (!(await fs.pathExists(requestPath))) {
    throw new Error(`Request not found: ${requestId}`);
  }
  const request = await parseRequest(requestPath);
  const routerConfig = await loadRouter(path.resolve('.aiflow/router.v1.json'));
  const runId = runIdOverride || makeRunId();
  const attempts: AttemptMap = { planning: 0, implementer: 0, qa: 0 };
  const runDir = path.join(config.paths.runs_dir, request.id, runId);
  const logsDir = path.join(runDir, 'logs');
  const patchesDir = path.join(runDir, 'patches');
  const contextPath = path.join(runDir, 'quality_context.json');
  await fs.ensureDir(logsDir);
  await fs.ensureDir(patchesDir);
  const lockPath = path.join(config.paths.locks_dir || path.join(config.paths.aiflow_dir || '.aiflow', 'locks'), `${request.id}.lock`);
  const locked = await acquireLock(lockPath, runId);
  if (!locked) {
    const error = makeError('RUN_IN_PROGRESS', 'Request is locked by another run', 'ENVIRONMENT');
    return { ok: false, request_id: request.id, run_id: runId, stage_path: '', planning_path: '', report_path: '', patches: [], error };
  }

  const patchPath = path.join(patchesDir, 'S01.patch');
  const logPrefix = path.join(logsDir, 'step.S01');
  // quality-gates schema check upfront
  const qualityRulesPath = path.resolve('.aiflow/quality-gates.v1.json');
  const rulesValid = await validateSchemaFile(qualityRulesPath, 'quality-rules.v1.schema.json');
  if (!rulesValid.ok) {
    const error = makeError('CONFIG_INVALID', `quality-gates schema error: ${rulesValid.errors}`, 'INPUT');
    return { ok: false, request_id: request.id, run_id: runId, stage_path: '', planning_path: '', report_path: '', patches: [], error };
  }

  let planning = buildPlanning(request, runId, config, patchPath, logPrefix);
  // Try planner LLM
  try {
    attempts.planning += 1;
    const tmpl = await readPrompt('planner.v1.md');
    const gatesJson = await fs.readFile(path.resolve('.aiflow/quality-gates.v1.json'), 'utf-8');
    const limitsJson = JSON.stringify(config.planning?.default_limits || planning.limits);
    const prompt = fill(tmpl, {
      constraints: '- local_only\n- no_gh\n- git_ok',
      quality_gates_json: gatesJson,
      planning_limits_json: limitsJson,
      request_markdown: request.raw
    });
    const plannerSchema = path.resolve('.aiflow/schemas/planner.contract.v1.json');
    const plannerRes = await callLlm(routerConfig, 'planner', prompt, plannerSchema);
    if (plannerRes.ok && plannerRes.json?.planning) {
      planning = { ...planning, ...(plannerRes.json.planning as PlanningFile), request_id: request.id, run_id: runId };
    }
  } catch {
    // fallback to built-in planning
  }
  const planningPath = path.join(runDir, 'planning.json');
  await writePlanning(planningPath, planning);
  const planningValid = await validateIfExists(planningPath, 'planning.contract.v1.json');
  if (!planningValid.ok) {
    const error = makeError('JSON_SCHEMA_INVALID', `planning.json schema error: ${planningValid.errors}`, 'CONTRACT');
    setError(createStage(request.id, runId, config, planningPath), error);
    await writeErrors(path.join(runDir, 'errors.json'), error);
    await releaseLock(lockPath);
    return { ok: false, request_id: request.id, run_id: runId, stage_path: planningPath, planning_path: planningPath, report_path: '', patches: [], error };
  }
  await writeQualityContext(contextPath, request, runId);
  await validateIfExists(contextPath, 'quality-context.v1.schema.json');

  const stagePath = path.join(runDir, 'stage.json');
  const stage: StageFile = createStage(request.id, runId, config, planningPath);
  stage.artifacts.planning_json = path.relative(process.cwd(), planningPath);
  stage.artifacts.logs_dir = path.relative(process.cwd(), logsDir);
  stage.locks.request_lock.held = true;
  stage.locks.request_lock.acquired_at = isoNow();
  await writeStage(stagePath, stage);

  try {
    if (config.repo?.enforce_work_branch) {
      await ensureWorkBranch(planning.base_branch, planning.work_branch);
    }

    // Planning phase
    setStage(stage, 'RUNNING', 'PLANNING', 'Planning', 'Generating planning.json', 10);
    await writeStage(stagePath, stage);

    // Implementing
    setStage(stage, 'RUNNING', 'IMPLEMENTING', 'Implementing', 'Generating patch', 30);
    stage.steps[0].status = 'RUNNING';
    stage.steps[0].attempt += 1;
    stage.steps[0].started_at = isoNow();
    await writeStage(stagePath, stage);

    let patchContent: string | null = null;
    // Try implementer LLM
    try {
      attempts.implementer += 1;
      process.stderr.write(chalk.gray(`Implementer role start run=${runId}\n`));
      const tmpl = await readPrompt('implementer.v1.md');
      const stepJson = JSON.stringify(planning.steps[0] || {}, null, 2);
      const targets = await fg(['**/*.*'], { cwd: process.cwd(), ignore: ['node_modules', 'runs', '.git', '.aiflow'] });
      const snapshot = targets.slice(0, 50).join('\n');
      const prompt = fill(tmpl, {
        constraints: '- keep diff small\n- no gh command\n',
        step_json: stepJson,
        targets_snapshot: snapshot
      });
      const implSchema = path.resolve('.aiflow/schemas/implementer.contract.v1.json');
      const implRes = await callLlm(routerConfig, 'implementer', prompt, implSchema);
      if (implRes.ok && implRes.json?.patch?.diff) {
        patchContent = implRes.json.patch.diff as string;
      }
    } catch {
      // ignore and fallback
    }
    if (!patchContent) {
      const placeholder = await generatePatch(runDir, request.id, runId);
      patchContent = placeholder.patchContent;
    }
    await fs.writeFile(patchPath, patchContent, 'utf-8');
    const relPatch = path.relative(process.cwd(), patchPath);
    stage.artifacts.patches.push(relPatch);
    stage.steps[0].patch_path = relPatch;

    // Apply
    setStage(stage, 'RUNNING', 'APPLYING', 'Applying', 'Applying patch (best-effort)', 45);
    await writeStage(stagePath, stage);
    const applyCheck = await tryGitApplyCheck(patchPath, process.cwd());
    if (!applyCheck.ok) {
      const err = makeError('PATCH_APPLY_FAILED', applyCheck.detail, 'GIT');
      stage.error = err;
      stage.steps[0].status = 'FAILED';
      status = 'NEEDS_INPUT';
    } else {
      await applyPatch(patchPath, process.cwd());
    }

    // Tests
    setStage(stage, 'RUNNING', 'TESTING', 'Testing', 'Running unit tests', 65);
    await writeStage(stagePath, stage);
    let unitLogPath: string | null = null;
    let qaIssues: any[] = [];
    if (config.tests?.unit?.enabled) {
      unitLogPath = `${logPrefix}.unit.log`;
      const res = await execCommand(config.tests.unit.command || "echo 'no unit tests'", process.cwd(), (config.tests.unit.timeout_sec || 60) * 1000);
      await fs.writeFile(unitLogPath, res.stdout + res.stderr, 'utf-8');
      stage.steps[0].test.unit = {
        status: res.code === 0 ? 'PASS' : 'FAIL',
        command: config.tests.unit.command || '',
        log_path: unitLogPath,
        duration_ms: null,
        failed_summary: res.code === 0 ? null : res.stderr.slice(0, 200)
      };
    } else {
      stage.steps[0].test.unit.status = 'SKIPPED';
    }

    stage.steps[0].status = stage.steps[0].test.unit.status === 'FAIL' ? 'FAILED' : 'DONE';
    stage.steps[0].ended_at = isoNow();

    // QA role (log/diff要約)
    if (stage.steps[0].status === 'DONE') {
      try {
        attempts.qa += 1;
        const qaPromptTmpl = await readPrompt('qa.v1.md');
        const diff = stage.artifacts.patches.join('\n');
        const unitLogExcerpt = unitLogPath ? (await fs.readFile(unitLogPath, 'utf-8')).slice(0, 1200) : '';
        const qaPrompt = fill(qaPromptTmpl, {
          constraints: '- summarize diff and test\n',
          acceptance_criteria_json: JSON.stringify(planning.context.acceptance_criteria || []),
          diff_base_to_head: diff || 'no diff',
          unit_log_excerpt: unitLogExcerpt || 'no unit log',
          e2e_log_excerpt: ''
        });
        const qaSchema = path.resolve('.aiflow/schemas/qa.contract.v1.json');
        const qaRes = await callLlm(routerConfig, 'qa', qaPrompt, qaSchema);
        if (qaRes.ok && Array.isArray(qaRes.json?.issues)) {
          qaIssues = qaRes.json.issues;
          if (qaRes.json.status === 'failed') {
            stage.error = makeError('QA_FAILED', 'QA reported issues', 'TEST');
            stage.steps[0].status = 'NEEDS_INPUT';
            status = 'NEEDS_INPUT';
          }
        }
      } catch {
        // ignore
      }
    }

    // Report
    let status = stage.steps[0].status === 'FAILED' ? 'NEEDS_INPUT' : 'DONE';
    setStage(stage, status === 'DONE' ? 'DONE' : 'NEEDS_INPUT', 'REPORTING', 'Reporting', 'Writing report', 90);
    const reportPath = path.join(runDir, 'report.md');
    await writeReport(reportPath, request, runId, unitLogPath, status, stage.error || undefined);
    stage.artifacts.report_md = path.relative(process.cwd(), reportPath);
    // errors.json if needed
    const errorsPath = path.join(runDir, 'errors.json');
    if (status !== 'DONE') {
      const err = stage.error ?? makeError('UNIT_TEST_FAILED', 'Unit tests failed or were skipped', 'TEST');
      await writeErrors(errorsPath, err);
      stage.artifacts.errors_json = path.relative(process.cwd(), errorsPath);
    }

    // Quality gates (D17-A)
    const gatesPath = path.resolve(process.cwd(), '.aiflow/quality-gates.v1.json');
    const gates = await evaluateQualityGates(process.cwd(), gatesPath, { request_id: request.id, run_id: runId });
    const gateFailed = gates.some((g) => !g.passed);
    if (gateFailed) {
      status = 'NEEDS_INPUT';
      stage.error = makeError('QUALITY_GATE_FAILED', 'One or more quality gates failed', 'EXECUTION');
    }

    // Compare URL (no gh)
    const compareUrl = await buildCompareUrl(planning.base_branch, planning.work_branch);
    stage.artifacts.compare_url = compareUrl;

    // optional push (no gh)
    if (config.git?.auto_push) {
      const pushRes = await tryGitPush(planning.work_branch);
      if (!pushRes.ok) {
        status = 'NEEDS_INPUT';
        stage.error = makeError('GIT_PUSH_FAILED', pushRes.detail, 'GIT');
      }
    }

    // Finalize
    setStage(stage, status === 'DONE' ? 'DONE' : 'NEEDS_INPUT', 'END', status === 'DONE' ? 'Completed' : 'Needs input', gateFailed ? 'Quality gate failed' : 'Finished', 100);
    stage.ended_at = isoNow();
    await writeStage(stagePath, stage);

    await releaseLock(lockPath);

    return {
      ok: status === 'DONE',
      request_id: request.id,
      run_id: runId,
      stage_path: path.relative(process.cwd(), stagePath),
      planning_path: path.relative(process.cwd(), planningPath),
      report_path: path.relative(process.cwd(), reportPath),
      patches: [path.relative(process.cwd(), patchPath)],
      error: status === 'DONE' ? undefined : (stage.error || makeError('UNIT_TEST_FAILED', 'Unit tests failed or were skipped', 'TEST'))
    };
  } catch (e: any) {
    const error = makeError('INTERNAL_ERROR', e.message || String(e));
    setError(stage, error);
    setStage(stage, 'FAILED', 'END', 'Failed', error.message, 100);
    stage.ended_at = isoNow();
    await writeStage(stagePath, stage);
    await releaseLock(lockPath);
    return { ok: false, request_id: request.id, run_id: runId, stage_path: stagePath, planning_path: planningPath, report_path: path.join(runDir, 'report.md'), patches: [], error };
  }
}

async function ensureWorkBranch(baseBranch: string, workBranch: string): Promise<void> {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
    const current = stdout.trim();
    if (current === workBranch) return;
    if (current === baseBranch) {
      try {
        await execAsync(`git checkout -B ${workBranch}`);
      } catch {
        // if checkout fails, leave as is
      }
    }
  } catch {
    // not a git repo; ignore
  }
}

async function buildCompareUrl(baseBranch: string, workBranch: string): Promise<string | null> {
  try {
    const { stdout: remote } = await execAsync('git remote get-url origin');
    const url = remote.trim();
    const re = new RegExp('github\\.com[:/](.+?)/([^/.]+)(\\.git)?$');
    const match = url.match(re);
    if (!match) return null;
    const owner = match[1];
    const repo = match[2];
    return `https://github.com/${owner}/${repo}/compare/${baseBranch}...${workBranch}?expand=1`;
  } catch {
    return null;
  }
}

async function tryGitApplyCheck(patchPath: string, root: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await execAsync(`git apply --check ${patchPath}`, { cwd: root });
    return { ok: true, detail: 'git apply --check ok' };
  } catch (e: any) {
    return { ok: false, detail: e.stderr || e.message };
  }
}

type AttemptMap = {
  planning: number;
  implementer: number;
  qa: number;
};

const MAX_RETRY_PER_ROLE = 2;

async function tryGitPush(workBranch: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await execAsync(`git push -u origin ${workBranch}`);
    return { ok: true, detail: 'pushed' };
  } catch (e: any) {
    return { ok: false, detail: e.stderr || e.message };
  }
}
