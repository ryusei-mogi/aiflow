import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs-extra';
import path from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const cache: Record<string, any> = {};

export async function validateWithSchema(targetPath: string, schemaPath: string): Promise<{ ok: boolean; errors?: string }> {
  if (!(await fs.pathExists(schemaPath))) return { ok: true };
  const json = await fs.readJSON(targetPath);
  let schema = cache[schemaPath];
  if (!schema) {
    schema = await fs.readJSON(schemaPath);
    cache[schemaPath] = schema;
  }
  const validate = ajv.compile(schema);
  const ok = validate(json);
  if (ok) return { ok: true };
  return { ok: false, errors: ajv.errorsText(validate.errors) };
}

export async function validateIfExists(targetPath: string, schemaName: string): Promise<{ ok: boolean; errors?: string }> {
  const schemaPath = path.resolve('.aiflow/schemas', schemaName);
  if (!(await fs.pathExists(targetPath))) return { ok: true };
  return validateWithSchema(targetPath, schemaPath);
}
