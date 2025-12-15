import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { RouterConfig } from './config.js';
import chalk from 'chalk';

const execAsync = util.promisify(exec);

export type LlmCallResult =
  | { ok: true; json: any; raw: string }
  | { ok: false; error: string; reason_code: string; raw?: string };

function buildCommand(router: RouterConfig, role: string, prompt: string): { cmd: string; env?: NodeJS.ProcessEnv } | null {
  const routing = router.routing?.[role];
  const provider = routing?.primary || Object.keys(router.models || {})[0];
  if (!provider) return null;
  const model = router.models?.[provider]?.[role] || router.models?.[provider]?.[`${role}_fallback`];
  const bin = router.cli_availability?.[provider]?.bin || provider;
  if (!bin || !model) return null;
  // Very simple command template: <bin> -m <model> -o json -y "<prompt>"
  const args = router.commands?.[provider]?.args;
  if (args && Array.isArray(args) && args.length) {
    const built = args.map((a: string) =>
      a
        .replace('{{model}}', model)
        .replace('{{prompt}}', prompt)
    );
    const cmd = [router.commands?.[provider]?.bin || bin, ...built].join(' ');
    return { cmd };
  }
  return { cmd: `${bin} -m "${model}" -o json -y "${prompt.replace(/"/g, '\\"')}"` };
}

async function validateWithSchema(json: any, schemaPath?: string): Promise<{ ok: boolean; errors?: string }> {
  if (!schemaPath || !(await fs.pathExists(schemaPath))) return { ok: true };
  const schema = await fs.readJSON(schemaPath);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(json);
  if (ok) return { ok: true };
  return { ok: false, errors: ajv.errorsText(validate.errors) };
}

export async function callLlm(router: RouterConfig, role: string, prompt: string, schemaPath?: string): Promise<LlmCallResult> {
  const command = buildCommand(router, role, prompt);
  if (!command) return { ok: false, error: 'provider or model not configured', reason_code: 'CLI_NOT_AVAILABLE' };
  try {
    const { stdout, stderr } = await execAsync(command.cmd, { maxBuffer: 2 * 1024 * 1024 });
    const raw = stdout || stderr;
    process.stderr.write(chalk.gray(`LLM ${role}: ${command.cmd}\n`));
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      return { ok: false, error: 'LLM output not JSON', reason_code: 'JSON_PARSE_ERROR', raw };
    }
    const jsonText = raw.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonText);
    const validation = await validateWithSchema(parsed, schemaPath);
    if (!validation.ok) {
      return { ok: false, error: validation.errors || 'schema invalid', reason_code: 'JSON_SCHEMA_INVALID', raw };
    }
    return { ok: true, json: parsed, raw };
  } catch (e: any) {
    return { ok: false, error: e.message || String(e), reason_code: 'CLI_NOT_AVAILABLE', raw: e.stdout || e.stderr };
  }
}
