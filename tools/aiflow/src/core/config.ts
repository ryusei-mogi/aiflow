import fs from 'fs-extra';
import path from 'path';

export type AiflowConfig = {
  version: string;
  mode?: string;
  server: { host: string; port: number };
  ui?: { port?: number; api_base?: string };
  paths: {
    repo_root?: string;
    requests_dir: string;
    runs_dir: string;
    aiflow_dir: string;
    locks_dir?: string;
    cache_dir?: string;
    tmp_dir?: string;
  };
  repo?: {
    base_branch?: string;
    work_branch_prefix?: string;
    require_clean_worktree?: boolean;
    enforce_work_branch?: boolean;
  };
  planning?: {
    default_steps?: { min: number; max: number; hard_max: number };
    default_limits?: { max_diff_lines: number; max_files: number; max_minutes: number };
  };
  runner?: {
    poll_stage_ms?: number;
    role_retry_max?: number;
    run_lock?: { enabled: boolean };
    lock_ttl_sec?: number;
  };
  git?: {
    branch_prefix?: string;
    max_branch_len?: number;
    auto_push?: boolean;
    auto_commit?: boolean;
  };
  tests?: {
    unit?: { enabled?: boolean; command?: string; timeout_sec?: number };
    e2e?: { enabled?: boolean; command?: string; timeout_sec?: number };
  };
};

export type RouterConfig = {
  version: string;
  mode: string;
  cli_availability?: Record<string, { required?: boolean; bin?: string }>;
  defaults?: { timeout_sec?: number; max_retries_per_call?: number };
  models?: Record<string, Record<string, string>>;
  routing?: Record<string, { primary: string; fallback?: string }>;
  overrides?: Array<{ when: Record<string, string>; use: string }>;
};

const DEFAULT_CONFIG: AiflowConfig = {
  version: '1.0',
  mode: 'no_token',
  server: { host: '127.0.0.1', port: 7331 },
  ui: { port: 7332, api_base: 'http://localhost:7331' },
  paths: {
    repo_root: '.',
    requests_dir: 'requests',
    runs_dir: 'runs',
    aiflow_dir: '.aiflow',
    locks_dir: '.aiflow/locks',
    cache_dir: '.aiflow/cache',
    tmp_dir: '.aiflow/tmp'
  },
  repo: {
    base_branch: 'main',
    work_branch_prefix: 'ai/',
    require_clean_worktree: true,
    enforce_work_branch: false
  },
  planning: {
    default_steps: { min: 1, max: 3, hard_max: 5 },
    default_limits: { max_diff_lines: 300, max_files: 10, max_minutes: 15 }
  },
  runner: {
    poll_stage_ms: 1200,
    role_retry_max: 2,
    run_lock: { enabled: true },
    lock_ttl_sec: 900
  },
  git: {
    branch_prefix: 'ai/',
    max_branch_len: 128,
    auto_push: false,
    auto_commit: false
  },
  tests: {
    unit: { enabled: true, command: "echo 'no unit tests configured'", timeout_sec: 60 },
    e2e: { enabled: false, command: "echo 'e2e disabled'", timeout_sec: 120 }
  }
};

export async function findConfigPath(startDir = process.cwd()): Promise<{ configPath: string; baseDir: string }> {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, '.aiflow', 'config.v1.json');
    if (await fs.pathExists(candidate)) return { configPath: candidate, baseDir: dir };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // fallback to startDir/.aiflow
  return { configPath: path.join(startDir, '.aiflow', 'config.v1.json'), baseDir: startDir };
}

export async function loadConfig(configPath?: string): Promise<AiflowConfig & { __baseDir: string }> {
  const located = configPath
    ? { configPath: path.resolve(configPath), baseDir: path.dirname(path.dirname(path.resolve(configPath))) }
    : await findConfigPath(process.cwd());
  let user: Partial<AiflowConfig> = {};
  if (await fs.pathExists(located.configPath)) {
    user = await fs.readJSON(located.configPath);
  }
  const merged: AiflowConfig & { __baseDir: string } = {
    ...DEFAULT_CONFIG,
    ...user,
    server: { ...DEFAULT_CONFIG.server, ...(user as any).server },
    ui: { ...DEFAULT_CONFIG.ui, ...(user as any).ui },
    paths: { ...DEFAULT_CONFIG.paths, ...(user as any).paths },
    repo: { ...DEFAULT_CONFIG.repo, ...(user as any).repo },
    planning: { ...DEFAULT_CONFIG.planning, ...(user as any).planning },
    runner: { ...DEFAULT_CONFIG.runner, ...(user as any).runner },
    git: { ...DEFAULT_CONFIG.git, ...(user as any).git },
    tests: {
      unit: { ...DEFAULT_CONFIG.tests?.unit, ...user?.tests?.unit },
      e2e: { ...DEFAULT_CONFIG.tests?.e2e, ...user?.tests?.e2e }
    },
    __baseDir: located.baseDir
  };

  // Resolve paths relative to baseDir
  merged.paths.requests_dir = path.resolve(located.baseDir, merged.paths.requests_dir);
  merged.paths.runs_dir = path.resolve(located.baseDir, merged.paths.runs_dir);
  merged.paths.aiflow_dir = path.resolve(located.baseDir, merged.paths.aiflow_dir || '.aiflow');
  if (merged.paths.locks_dir) merged.paths.locks_dir = path.resolve(located.baseDir, merged.paths.locks_dir);
  if (merged.paths.cache_dir) merged.paths.cache_dir = path.resolve(located.baseDir, merged.paths.cache_dir);
  if (merged.paths.tmp_dir) merged.paths.tmp_dir = path.resolve(located.baseDir, merged.paths.tmp_dir);

  await fs.ensureDir(merged.paths.requests_dir);
  await fs.ensureDir(merged.paths.runs_dir);
  if (merged.paths.locks_dir) await fs.ensureDir(merged.paths.locks_dir);
  if (merged.paths.cache_dir) await fs.ensureDir(merged.paths.cache_dir);
  if (merged.paths.tmp_dir) await fs.ensureDir(merged.paths.tmp_dir);

  return merged;
}

export async function loadRouter(routerPath?: string, baseDir?: string): Promise<RouterConfig> {
  const candidate = routerPath
    ? path.resolve(routerPath)
    : path.join(baseDir || (await findConfigPath()).baseDir, '.aiflow', 'router.v1.json');
  if (!(await fs.pathExists(candidate))) {
    return {
      version: '1.0',
      mode: 'no_token',
      defaults: { timeout_sec: 180, max_retries_per_call: 1 },
      routing: {},
      models: {},
      overrides: []
    };
  }
  return fs.readJSON(candidate);
}
