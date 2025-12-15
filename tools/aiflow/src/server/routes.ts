import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { loadConfig, loadRouter, AiflowConfig } from '../core/config.js';
import { runDoctor } from '../core/doctor.js';
import { listRequests, getRequestById, createRequest } from '../core/requests.js';
import { parseRequest, updateRequestMeta, saveRequestMarkdown } from '../core/meta.js';
import { latestRun, listRunsForRequest, loadStage } from '../core/runs.js';
import { runRequest } from '../core/runner.js';
import { RunnerResult } from '../types.js';

export async function buildRouter(configPath?: string) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  let cachedConfig: AiflowConfig = await loadConfig(configPath);

  router.get('/health', (_req, res) => res.json({ ok: true }));

  router.get('/config', async (_req, res) => {
    cachedConfig = await loadConfig(configPath);
    res.json({ config: cachedConfig });
  });

  router.put('/config', async (req, res) => {
    const body = req.body?.config;
    if (!body) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'config missing' } });
    const target = configPath || path.resolve('.aiflow/config.v1.json');
    await fs.writeJson(target, body, { spaces: 2 });
    cachedConfig = await loadConfig(configPath);
    res.json({ ok: true, config: cachedConfig });
  });

  router.post('/doctor', async (_req, res) => {
    const result = await runDoctor(cachedConfig, path.resolve('.aiflow/router.v1.json'));
    res.json(result);
  });

  router.get('/requests', async (req, res) => {
    const list = await listRequests(cachedConfig.paths.requests_dir, { priority: req.query.priority as string, q: req.query.q as string });
    const withRuns = await Promise.all(list.map(async (r) => {
      const latest = await latestRun(cachedConfig.paths.runs_dir, r.id);
      return {
        id: r.id,
        path: r.path,
        title: r.title,
        priority: r.meta.priority,
        status: r.meta.status,
        updated_at: r.meta.updated_at,
        meta: r.meta,
        latest_run: latest
      };
    }));
    res.json({ requests: withRuns });
  });

  router.get('/requests/:id', async (req, res) => {
    const r = await getRequestById(cachedConfig.paths.requests_dir, req.params.id);
    if (!r) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'request not found' } });
    res.json({ id: r.id, path: r.path, markdown: r.raw, meta: r.meta, title: r.title });
  });

  router.put('/requests/:id', async (req, res) => {
    const markdown = req.body?.markdown;
    const expected = req.body?.expected_updated_at;
    if (typeof markdown !== 'string') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'markdown required' } });
    const file = path.join(cachedConfig.paths.requests_dir, `${req.params.id}.md`);
    if (!(await fs.pathExists(file))) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'request not found' } });
    const current = await parseRequest(file);
    if (expected && current.meta.updated_at && current.meta.updated_at !== expected) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'updated_at mismatch' } });
    }
    await saveRequestMarkdown(file, markdown);
    const parsed = await parseRequest(file);
    res.json({ ok: true, updated_at: parsed.meta.updated_at, request: parsed });
  });

  router.patch('/requests/:id/meta', async (req, res) => {
    const file = path.join(cachedConfig.paths.requests_dir, `${req.params.id}.md`);
    if (!(await fs.pathExists(file))) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'request not found' } });
    const parsed = await updateRequestMeta(file, req.body || {});
    res.json(parsed);
  });

  router.post('/requests', async (req, res) => {
    const { title, priority } = req.body || {};
    if (!title) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'title required' } });
    const prio = priority || 'P2';
    const r = await createRequest(cachedConfig.paths.requests_dir, title, prio);
    res.status(201).json({ id: r.id, path: r.path });
  });

  router.post('/requests/:id/run', async (req, res) => {
    const requestId = req.params.id;
    try {
      const result: RunnerResult = await runRequest(requestId, cachedConfig);
      res.status(result.ok ? 202 : 409).json({
        request_id: result.request_id,
        run_id: result.run_id,
        status: result.ok ? 'done' : 'needs_input',
        error: result.error
      });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL', message: e.message || String(e) } });
    }
  });

  router.get('/requests/:id/runs', async (req, res) => {
    const runs = await listRunsForRequest(cachedConfig.paths.runs_dir, req.params.id);
    res.json({ runs });
  });

  router.get('/requests/:id/runs/latest', async (req, res) => {
    const run = await latestRun(cachedConfig.paths.runs_dir, req.params.id);
    if (!run) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'run not found' } });
    res.json({ run });
  });

  router.get('/requests/:id/runs/:runId/stage', async (req, res) => {
    const stagePath = path.join(cachedConfig.paths.runs_dir, req.params.id, req.params.runId, 'stage.json');
    if (!(await fs.pathExists(stagePath))) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'stage missing' } });
    const stage = await loadStage(stagePath);
    res.json({ stage });
  });

  router.get('/requests/:id/runs/:runId/context', async (req, res) => {
    const contextPath = path.join(cachedConfig.paths.runs_dir, req.params.id, req.params.runId, 'quality_context.json');
    if (!(await fs.pathExists(contextPath))) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'context missing' } });
    const context = await fs.readJSON(contextPath);
    res.json({ context });
  });

  router.get('/requests/:id/runs/:runId/errors', async (req, res) => {
    const errorsPath = path.join(cachedConfig.paths.runs_dir, req.params.id, req.params.runId, 'errors.json');
    if (!(await fs.pathExists(errorsPath))) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'errors missing' } });
    const errors = await fs.readJSON(errorsPath);
    res.json({ errors });
  });

  router.get('/requests/:id/runs/:runId/report', async (req, res) => {
    const reportPath = path.join(cachedConfig.paths.runs_dir, req.params.id, req.params.runId, 'report.md');
    if (!(await fs.pathExists(reportPath))) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'report missing' } });
    const md = await fs.readFile(reportPath, 'utf-8');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(md);
  });

  // Router config (read-only)
  router.get('/router', async (_req, res) => {
    res.json({ router: await loadRouter(path.resolve('.aiflow/router.v1.json')) });
  });

  return router;
}
