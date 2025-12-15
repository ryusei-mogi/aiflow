import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { loadConfig } from '../core/config.js';
import { buildRouter } from './routes.js';

async function main() {
  const config = await loadConfig();
  const app = express();
  app.use(cors());

  const apiRouter = await buildRouter();
  app.use('/api', apiRouter);

  // Static UI (built)
  const uiDist = path.resolve('tools/aiflow/ui/dist');
  if (await fs.pathExists(uiDist)) {
    app.use(express.static(uiDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(uiDist, 'index.html'));
    });
  }

  app.listen(config.server.port, config.server.host, () => {
    console.log(`AIFLOW server listening at http://${config.server.host}:${config.server.port}`);
  });
}

main().catch((e) => {
  console.error('Failed to start server', e);
  process.exit(1);
});
