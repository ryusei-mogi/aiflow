import fs from 'fs-extra';
import path from 'path';
import { ParsedRequest } from '../types.js';
import { parseRequest, priorityValue } from './meta.js';

export async function listRequests(requestsDir: string, query?: { priority?: string; q?: string }): Promise<ParsedRequest[]> {
  const files = (await fs.pathExists(requestsDir)) ? await fs.readdir(requestsDir) : [];
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const parsed: ParsedRequest[] = [];
  for (const file of mdFiles) {
    const full = path.join(requestsDir, file);
    parsed.push(await parseRequest(full));
  }
  const filtered = parsed.filter((r) => {
    if (query?.priority && r.meta.priority !== query.priority) return false;
    if (query?.q) {
      const needle = query.q.toLowerCase();
      if (!r.title.toLowerCase().includes(needle) && !r.body_markdown.toLowerCase().includes(needle)) return false;
    }
    return true;
  });
  filtered.sort((a, b) => {
    const pa = priorityValue(a.meta.priority);
    const pb = priorityValue(b.meta.priority);
    if (pa !== pb) return pa - pb;
    return (b.meta.updated_at || '').localeCompare(a.meta.updated_at || '');
  });
  return filtered;
}

export async function getRequestById(requestsDir: string, id: string): Promise<ParsedRequest | null> {
  const file = path.join(requestsDir, `${id}.md`);
  if (!(await fs.pathExists(file))) return null;
  return parseRequest(file);
}

export async function createRequest(requestsDir: string, title: string, priority: string): Promise<ParsedRequest> {
  const today = new Date();
  const id = `RQ-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${Math.random().toString(16).slice(2, 6)}`;
  const file = path.join(requestsDir, `${id}.md`);
  const meta = {
    priority,
    status: 'draft',
    labels: [],
    depends_on: [],
    estimate: 'M',
    created_at: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString().slice(0, 10),
    unknown: {}
  } as any;
  const body = `# ${title}\n\n- Acceptance Criteria:\n  1. Describe expected behavior\n  2. Describe test expectation\n`;
  await fs.writeFile(file, Object.entries(meta)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => Array.isArray(v) ? `${k}: [${(v as string[]).join(', ')}]` : `${k}: ${v}`)
    .join('\n') + '\n\n' + body, 'utf-8');
  return parseRequest(file);
}
