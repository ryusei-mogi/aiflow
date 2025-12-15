import fs from 'fs-extra';
import path from 'path';
import fg from 'fast-glob';
import http from 'http';

type GateCheck =
  | { type: 'string_absence'; paths: string[]; pattern: string }
  | { type: 'gitignore_contains'; path: string; line: string }
  | { type: 'file_exists'; path: string }
  | { type: 'http_status'; url: string; status: number };

type Gate = {
  id: string;
  name: string;
  severity: string;
  check: GateCheck;
};

export type GateResult = {
  id: string;
  name: string;
  severity: string;
  passed: boolean;
  detail?: string;
};

async function checkStringAbsence(root: string, c: Extract<GateCheck, { type: 'string_absence' }>): Promise<boolean> {
  const entries = await fg(c.paths, {
    cwd: root,
    ignore: ['node_modules', '.git', '.aiflow/cache', '.aiflow/tmp'],
    dot: false
  });
  const regex = new RegExp(c.pattern, 'm');
  for (const file of entries) {
    const content = await fs.readFile(path.join(root, file), 'utf-8');
    if (regex.test(content)) return false;
  }
  return true;
}

async function checkGitignoreContains(root: string, c: Extract<GateCheck, { type: 'gitignore_contains' }>): Promise<boolean> {
  const target = path.join(root, c.path);
  if (!(await fs.pathExists(target))) return false;
  const text = await fs.readFile(target, 'utf-8');
  return text.split(/\r?\n/).some((line) => line.trim() === c.line.trim());
}

async function checkFileExists(root: string, c: Extract<GateCheck, { type: 'file_exists' }>): Promise<boolean> {
  return fs.pathExists(path.join(root, c.path));
}

async function checkHttpStatus(c: Extract<GateCheck, { type: 'http_status' }>): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(c.url, (res) => {
      resolve(res.statusCode === c.status);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function evaluateQualityGates(root: string, gatesPath: string, context: Record<string, string>): Promise<GateResult[]> {
  if (!(await fs.pathExists(gatesPath))) return [];
  const def = await fs.readJSON(gatesPath);
  const gates: Gate[] = def.gates || [];
  const results: GateResult[] = [];

  for (const gate of gates) {
    const check = gate.check;
    let passed = true;
    let detail: string | undefined;
    // simple template replacement {{request_id}}, {{run_id}}
    const replace = (s: string) => s.replace(/{{request_id}}/g, context.request_id || '').replace(/{{run_id}}/g, context.run_id || '');
    try {
      switch (check.type) {
        case 'string_absence':
          passed = await checkStringAbsence(root, { ...check, paths: check.paths.map(replace) });
          break;
        case 'gitignore_contains':
          passed = await checkGitignoreContains(root, { ...check, path: replace(check.path), line: check.line });
          break;
        case 'file_exists':
          passed = await checkFileExists(root, { ...check, path: replace(check.path) });
          break;
        case 'http_status':
          passed = await checkHttpStatus({ ...check, url: replace(check.url) });
          break;
        default:
          passed = true;
      }
    } catch (e: any) {
      passed = false;
      detail = e.message || String(e);
    }
    results.push({ id: gate.id, name: gate.name, severity: gate.severity, passed, detail });
  }
  return results;
}
