export type Priority = "P0" | "P1" | "P2" | "P3";
export type Status = "draft" | "ready" | "running" | "blocked" | "done" | "archived";

export type RequestMeta = {
  priority?: Priority;
  status?: Status;
  labels?: string[];
  depends_on?: string[];
  estimate?: "S" | "M" | "L";
  created_at?: string;
  updated_at?: string;
  unknown: Record<string, string>;
};

export type ParsedRequest = {
  id: string;
  path: string;
  meta: RequestMeta;
  title: string;
  body_markdown: string;
  raw: string;
};

export type DoctorCheck = {
  id: string;
  title: string;
  status: "PASS" | "WARN" | "FAIL";
  detail?: string;
};

export type DoctorResult = {
  status: "PASS" | "WARN" | "FAIL";
  checks: DoctorCheck[];
  summary?: { pass: number; warn: number; fail: number };
};

export type StageState = "QUEUED" | "RUNNING" | "NEEDS_INPUT" | "FAILED" | "DONE" | "CANCELED";
export type StagePhase =
  | "INIT"
  | "LOCK_ACQUIRED"
  | "PLANNING"
  | "IMPLEMENTING"
  | "APPLYING"
  | "TESTING"
  | "REPORTING"
  | "FINALIZING"
  | "END";

export type ErrorObject = {
  category: "ENVIRONMENT" | "INPUT" | "CONTRACT" | "EXECUTION" | "TEST" | "GIT";
  reason_code: string;
  title: string;
  message: string;
  severity: "Blocker" | "Major" | "Minor";
  retryable: boolean;
  actions: string[];
  related_paths?: string[];
  meta?: Record<string, unknown>;
};

export type QAIssue = {
  severity?: string;
  description?: string;
  hint?: string;
};

export type StepTestResult = {
  status: "NOT_RUN" | "RUNNING" | "PASS" | "FAIL" | "SKIPPED";
  command: string | null;
  log_path: string | null;
  duration_ms: number | null;
  failed_summary: string | null;
};

export type StepState = {
  step_id: string;
  title: string;
  role: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED" | "NEEDS_INPUT";
  started_at: string | null;
  ended_at: string | null;
  attempt: number;
  summary: string;
  logs: string[];
  patch_path: string | null;
  diff_stat: {
    files_changed: number;
    lines_added: number;
    lines_deleted: number;
    too_large: boolean;
  };
  test: {
    unit: StepTestResult;
    e2e: StepTestResult;
  };
  error: ErrorObject | null;
  qa_issues?: any[];
};

export type StageFile = {
  version: "1.0";
  request_id: string;
  run_id: string;
  state: StageState;
  stage: StagePhase;
  title: string;
  started_at: string;
  updated_at: string;
  ended_at: string | null;
  progress: { percent: number; message: string; eta_sec: number | null };
  current_step_index: number;
  steps: StepState[];
  locks: {
    request_lock: { path: string; held: boolean; acquired_at: string | null; ttl_sec: number };
    queue_lock: { path: string; held: boolean; acquired_at: string | null; ttl_sec: number };
  };
  artifacts: {
    request_path: string;
    planning_json: string | null;
    report_md: string;
    errors_json: string | null;
    patches: string[];
    logs_dir: string;
    compare_url: string | null;
  };
  error: ErrorObject | null;
  counters: {
    planner_calls: number;
    implementer_calls: number;
    qa_calls: number;
    unit_runs: number;
    e2e_runs: number;
    autofix_cycles: number;
    retries: number;
  };
  signals: { stop_requested: boolean; resume_requested: boolean; notes: string | null };
};

export type PlanningFile = {
  version: "1.0";
  request_id: string;
  run_id: string;
  created_at: string;
  base_branch: string;
  work_branch: string;
  limits: {
    max_diff_lines: number;
    max_files_changed?: number;
    timeout_sec: number;
    max_steps_per_run: number;
    max_autofix_cycles: number;
  };
  context: {
    summary: string;
    constraints: string[];
    acceptance_criteria: Array<{ id: string; given: string; when: string; then: string; type?: string }>;
    test_instructions: { unit?: string; e2e?: string };
    project_facts?: Record<string, unknown>;
  };
  gates: {
    require_clean_worktree: boolean;
    require_work_branch: boolean;
    require_unit_pass: boolean;
    require_e2e_for_regression_ac: boolean;
    forbid_gh: boolean;
    max_step_too_large_retries: number;
  };
  steps: Array<{
    step_id: string;
    title: string;
    role: string;
    intent: string;
    scope: {
      target_paths: string[];
      forbidden_paths?: string[];
      max_diff_lines: number;
      max_files_changed?: number;
    };
    inputs: {
      request_path: string;
      context_files?: string[];
      code_files_hint?: string[];
    };
    commands: { unit?: string[]; e2e?: string[] };
    success_criteria: string[];
    links_to_ac: string[];
    expected_diff: { lines_max: number; files_max?: number; risk_level: string };
    outputs: { patch_path: string; log_prefix: string };
  }>;
  outputs: {
    planning_json: string;
    stage_json: string;
    report_md: string;
    errors_json?: string;
  };
  assumptions?: string[];
  risks?: string[];
};

export type RunnerResult = {
  ok: boolean;
  request_id: string;
  run_id: string;
  stage_path: string;
  planning_path: string;
  report_path: string;
  patches: string[];
  error?: ErrorObject;
};
