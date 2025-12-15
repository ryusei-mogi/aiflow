#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './core/config.js';
import { runDoctor } from './core/doctor.js';
import { listRequests, getRequestById } from './core/requests.js';
import { runRequest } from './core/runner.js';
import { priorityValue } from './core/meta.js';
import { latestRun } from './core/runs.js';

const program = new Command();
program.name('aiflow').description('aiflow-local CLI');

program
  .command('dev')
  .description('start API server (UI dev via npm run ui)')
  .action(async () => {
    await import('./server/index.js');
  });

program
  .command('doctor')
  .description('run environment checks')
  .action(async () => {
    const config = await loadConfig();
    const result = await runDoctor(config);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'FAIL') process.exit(3);
  });

program
  .command('list')
  .description('list requests')
  .option('--status <status>')
  .option('--priority <priority>')
  .action(async (opts) => {
    const config = await loadConfig();
    const list = await listRequests(config.paths.requests_dir, { priority: opts.priority });
    const filtered = opts.status ? list.filter((r) => r.meta.status === opts.status) : list;
    filtered.forEach((r) => {
      console.log(`${r.id}\t${r.meta.priority || ''}\t${r.meta.status || ''}\t${r.title}`);
    });
  });

program
  .command('show <requestId>')
  .description('show a request')
  .action(async (requestId) => {
    const config = await loadConfig();
    const req = await getRequestById(config.paths.requests_dir, requestId);
    if (!req) {
      console.error('Request not found');
      process.exit(2);
    }
    console.log(`# ${req.title}\n`);
    console.log(req.raw);
  });

program
  .command('run')
  .requiredOption('--request <id>', 'request id')
  .description('run a request')
  .action(async (opts) => {
    const config = await loadConfig();
    const result = await runRequest(opts.request, config);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 7);
  });

program
  .command('run-next')
  .description('pick next ready request by priority and run')
  .action(async () => {
    const config = await loadConfig();
    const list = await listRequests(config.paths.requests_dir);
    const ready = list.filter((r) => r.meta.status === 'ready');
    ready.sort((a, b) => priorityValue(a.meta.priority) - priorityValue(b.meta.priority));
    if (!ready.length) {
      console.error('No ready requests');
      process.exit(2);
    }
    const target = ready[0];
    console.log(`Running ${target.id} (${target.title})`);
    const result = await runRequest(target.id, config);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 7);
  });

program.parseAsync(process.argv);
