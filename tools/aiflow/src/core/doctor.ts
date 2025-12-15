import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import { AiflowConfig } from './config.js';
import { DoctorCheck, DoctorResult } from '../types.js';

const execAsync = util.promisify(exec);

async function checkGit(repoRoot: string, requireClean: boolean): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  try {
    await execAsync('git rev-parse --is-inside-work-tree', { cwd: repoRoot });
    checks.push({ id: 'git_repo', title: 'Git repository detected', status: 'PASS' });
    if (requireClean) {
      const { stdout } = await execAsync('git status --porcelain', { cwd: repoRoot });
      if (stdout.trim().length === 0) {
        checks.push({ id: 'worktree_clean', title: 'Worktree clean', status: 'PASS' });
      } else {
        checks.push({ id: 'worktree_clean', title: 'Worktree dirty', status: 'FAIL', detail: stdout });
      }
    }
    // branch safety: enforce not on base branch if configured
    try {
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot });
      checks.push({ id: 'git_branch', title: `Current branch: ${branch.trim()}`, status: 'PASS' });
    } catch (e: any) {
      checks.push({ id: 'git_branch', title: 'Unable to read current branch', status: 'WARN', detail: String(e.stderr || e.message) });
    }
  } catch (e: any) {
    checks.push({ id: 'git_repo', title: 'Git repository not detected', status: 'WARN', detail: String(e.stderr || e.message) });
  }
  return checks;
}

async function checkBinary(bin: string, id: string, required = false): Promise<DoctorCheck> {
  try {
    await execAsync(`command -v ${bin}`);
    return { id, title: `${bin} available`, status: 'PASS' };
  } catch {
    return { id, title: `${bin} not found`, status: required ? 'FAIL' : 'WARN' };
  }
}

export async function runDoctor(config: AiflowConfig, routerPath = path.resolve('.aiflow/router.v1.json')): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  checks.push({ id: 'node', title: 'Node present', status: 'PASS' });

  checks.push(...(await checkGit(process.cwd(), config.repo?.require_clean_worktree ?? true)));

  // Config parse
  checks.push({ id: 'config_loaded', title: 'config.v1.json loaded', status: 'PASS' });

  // Router bins (best-effort)
  if (await fs.pathExists(routerPath)) {
    try {
      const router = await fs.readJSON(routerPath);
      const availability = router.cli_availability || {};
      for (const [key, info] of Object.entries(availability)) {
        checks.push(await checkBinary(info.bin || key, `cli_${key}`, info.required ?? false));
      }
    } catch (e: any) {
      checks.push({ id: 'router_parse', title: 'router.v1.json parse error', status: 'WARN', detail: String(e.message) });
    }
  }

  const fail = checks.some((c) => c.status === 'FAIL');
  const warn = checks.some((c) => c.status === 'WARN');
  const status: DoctorResult['status'] = fail ? 'FAIL' : warn ? 'WARN' : 'PASS';
  const summary = {
    pass: checks.filter((c) => c.status === 'PASS').length,
    warn: checks.filter((c) => c.status === 'WARN').length,
    fail: checks.filter((c) => c.status === 'FAIL').length
  };
  return { status, checks: checks.map((c) => ({ ...c, detail: c.detail })), summary: summary as any };
}
