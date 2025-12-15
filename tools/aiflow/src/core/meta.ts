import fs from 'fs-extra';
import path from 'path';
import { ParsedRequest, RequestMeta } from '../types.js';

const META_ORDER = [
  'priority',
  'status',
  'labels',
  'depends_on',
  'estimate',
  'created_at',
  'updated_at'
];

function parseArray(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function parseRequest(filePath: string): Promise<ParsedRequest> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const meta: RequestMeta = { unknown: {} };
  let metaEndIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      metaEndIndex = i + 1; // include blank line
      break;
    }
    const match = line.match(/^([a-z_]+)\s*:\s*(.+)$/);
    if (!match) {
      metaEndIndex = 0;
      break;
    }
    const [, key, valueRaw] = match;
    const value = valueRaw.trim();
    if (value.startsWith('[')) {
      const arr = parseArray(value);
      if (arr !== null) {
        (meta as any)[key] = arr;
      } else {
        meta.unknown[key] = valueRaw;
      }
    } else {
      (meta as any)[key] = value;
    }
    metaEndIndex = i + 1;
  }
  // ifファイルが最後までメタのみで終わる場合
  if (metaEndIndex === lines.length) {
    metaEndIndex = lines.length;
  }
  const bodyLines = lines.slice(metaEndIndex);
  const body_markdown = bodyLines.join('\n');
  const titleMatch = body_markdown.match(/^#\s+(.+)$/m);
  const id = path.basename(filePath, path.extname(filePath));
  return {
    id,
    path: filePath,
    meta,
    title: titleMatch ? titleMatch[1].trim() : id,
    body_markdown,
    raw
  };
}

export function serializeMeta(meta: RequestMeta): string {
  const orderedKeys = [...META_ORDER];
  const unknownKeys = Object.keys(meta.unknown || {}).sort();
  const lines: string[] = [];
  for (const key of orderedKeys) {
    const value = (meta as any)[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(', ')}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  for (const key of unknownKeys) {
    lines.push(`${key}: ${meta.unknown[key]}`);
  }
  const metaBlock = lines.join('\n');
  return metaBlock.length ? metaBlock + '\n\n' : '';
}

export async function writeRequest(filePath: string, meta: RequestMeta, body: string): Promise<void> {
  const out = serializeMeta(meta) + body.replace(/^\n+/, '');
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, out, 'utf-8');
}

export async function updateRequestMeta(filePath: string, updates: Partial<RequestMeta>): Promise<ParsedRequest> {
  const parsed = await parseRequest(filePath);
  const merged: RequestMeta = { ...parsed.meta, ...updates, unknown: { ...parsed.meta.unknown } };
  const today = new Date().toISOString().slice(0, 10);
  if (!merged.created_at) merged.created_at = today;
  merged.updated_at = today;
  await writeRequest(filePath, merged, parsed.body_markdown);
  return parseRequest(filePath);
}

export async function saveRequestMarkdown(filePath: string, markdown: string): Promise<ParsedRequest> {
  const parsed = await parseRequest(filePath);
  await fs.writeFile(filePath, markdown, 'utf-8');
  return parseRequest(filePath);
}

export function priorityValue(p?: string): number {
  switch (p) {
    case 'P0':
      return 0;
    case 'P1':
      return 1;
    case 'P2':
      return 2;
    case 'P3':
      return 3;
    default:
      return 99;
  }
}
