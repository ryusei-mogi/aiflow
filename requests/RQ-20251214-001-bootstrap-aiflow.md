priority: P0
status: ready
labels: [aiflow, bootstrap]
depends_on: []
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14

# Bootstrap aiflow local tool

- Goal: Stand up minimal aiflow-local pipeline that can list requests, start a run, and produce artifacts.
- Acceptance Criteria:
  1. `npm run aiflow:dev` starts API server (and UI dev proxy) without errors.
  2. UI shows this request with status/priority and can edit/save markdown.
  3. Clicking Run creates `runs/RQ-20251214-001-.../` with `planning.json`, `stage.json`, `report.md` and a patch placeholder.
  4. Doctor command reports environment checks.
  5. No dependency on GitHub CLI.
