import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`API ${res.status}`);
  if (res.headers.get('content-type')?.includes('application/json')) return res.json();
  return res.text();
};

function useRequests() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const data = await api('/api/requests');
      setItems(data.requests || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return { items, load, loading };
}

function RequestEditor({ request, onSave }: { request: any; onSave: (next: any) => void }) {
  const [markdown, setMarkdown] = useState(request?.markdown || '');
  useEffect(() => setMarkdown(request?.markdown || ''), [request?.id]);
  if (!request) return <div className="panel">Select a request</div>;
  const update = async () => {
    const data = await api(`/api/requests/${request.id}`, { method: 'PUT', body: JSON.stringify({ markdown }) });
    onSave(data.request);
  };
  const updateMeta = async (metaPatch: Record<string, any>) => {
    const data = await api(`/api/requests/${request.id}/meta`, { method: 'PATCH', body: JSON.stringify(metaPatch) });
    onSave(data);
  };
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{request.title}</h2>
          <small>{request.id}</small>
        </div>
        <div className="meta-row">
          <label>
            Priority
            <select value={request.meta.priority || 'P2'} onChange={(e) => updateMeta({ priority: e.target.value })}>
              {['P0', 'P1', 'P2', 'P3'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={request.meta.status || 'draft'} onChange={(e) => updateMeta({ status: e.target.value })}>
              {['draft', 'ready', 'running', 'blocked', 'done', 'archived'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={18} />
      <div className="actions">
        <button onClick={update}>Save</button>
      </div>
    </div>
  );
}

function RunPanel({ requestId }: { requestId: string | null }) {
  const [stage, setStage] = useState<any | null>(null);
  const [report, setReport] = useState<string>('');
  const [errors, setErrors] = useState<any | null>(null);
  const [messages, setMessages] = useState<Record<string, any> | null>(null);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  const [logs, setLogs] = useState<{unit?: string; qa?: string}>({});
  const [logsE2E, setLogsE2E] = useState<string>('');
  const [qaIssues, setQaIssues] = useState<any[]>([]);

  const loadMessages = async () => {
    try {
      const m = await api('/api/messages');
      setMessages(m.messages?.reason_codes || {});
    } catch {
      setMessages(null);
    }
  };

  const loadLatest = async () => {
    if (!requestId) return;
    try {
      const latest = await api(`/api/requests/${requestId}/runs/latest`);
      const runId = latest.run.run_id;
      const stageResp = await api(`/api/requests/${requestId}/runs/${runId}/stage`);
      setStage(stageResp.stage);
      setSteps(stageResp.stage?.steps || []);
      const stepQaIssues = (stageResp.stage?.steps || []).flatMap((s: any) => s.qa_issues || []);
      setQaIssues(stepQaIssues);
      try {
        const reportText = await api(`/api/requests/${requestId}/runs/${runId}/report`);
        setReport(typeof reportText === 'string' ? reportText : '');
      } catch (e) {
        setReport('');
      }
      try {
        const err = await api(`/api/requests/${requestId}/runs/${runId}/errors`);
        setErrors(err.errors?.error || null);
        if (err.errors?.error?.meta?.issues) {
          setQaIssues(err.errors.error.meta.issues);
        }
      } catch {
        setErrors(null);
      }
      try {
        const unitLog = await api(`/api/requests/${requestId}/runs/${runId}/logs/unit`);
        setLogs((prev) => ({ ...prev, unit: unitLog }));
      } catch { setLogs((prev) => ({ ...prev, unit: '' })); }
      try {
        const qaLog = await api(`/api/requests/${requestId}/runs/${runId}/logs/qa`);
        setLogs((prev) => ({ ...prev, qa: qaLog }));
      } catch { setLogs((prev) => ({ ...prev, qa: '' })); }
      try {
        const e2eLog = await api(`/api/requests/${requestId}/runs/${runId}/logs/e2e`);
        setLogsE2E(typeof e2eLog === 'string' ? e2eLog : '');
      } catch { setLogsE2E(''); }
    } catch {
      setStage(null);
      setReport('');
      setErrors(null);
      setSteps([]);
      setLogs({});
      setQaIssues([]);
      setLogsE2E('');
    }
  };

  const run = async () => {
    if (!requestId) return;
    setRunning(true);
    try {
      await api(`/api/requests/${requestId}/run`, { method: 'POST', body: JSON.stringify({}) });
      await loadLatest();
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    loadLatest();
    const timer = setInterval(loadLatest, 2000);
    return () => clearInterval(timer);
  }, [requestId]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Run</h3>
        <button onClick={run} disabled={!requestId || running}>
          {running ? 'Running...' : 'Run'}
        </button>
      </div>
      {stage ? (
        <div className="stage">
          <div><strong>State:</strong> {stage.state}</div>
          <div><strong>Stage:</strong> {stage.stage}</div>
          <div><strong>Progress:</strong> {stage.progress?.percent}% - {stage.progress?.message}</div>
          <div><strong>Updated:</strong> {stage.updated_at}</div>
          {stage.error && (
            <div className="error-box">
              <div><strong>Error:</strong> {stage.error.reason_code}</div>
              <div>{messages?.[stage.error.reason_code]?.title || stage.error.title}</div>
              <ul>
                {(messages?.[stage.error.reason_code]?.actions || stage.error.actions || []).map((a: string) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}
          <div className="steps-grid">
            {steps.map((s) => (
              <div key={s.step_id} className={`step-card status-${s.status.toLowerCase()}`}>
                <div className="step-title">{s.step_id}: {s.title}</div>
                <div className="step-status">{s.status}</div>
                <div className="step-summary">{s.summary}</div>
                {s.qa_issues && s.qa_issues.length > 0 && (
                  <div className="qa-issues">
                    <div className="qa-title">QA Issues:</div>
                    <ul>
                      {s.qa_issues.map((i: any, idx: number) => (
                        <li key={idx}>{i.severity ? `[${i.severity}] ` : ''}{i.description || i}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          {errors && (
            <div className="error-box">
              <div><strong>Error:</strong> {errors.reason_code}</div>
              <div>{messages?.[errors.reason_code]?.title || errors.title}</div>
              <ul>
                {(messages?.[errors.reason_code]?.actions || errors.actions || []).map((a: string) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div>No run yet.</div>
      )}
      <div className="report">
        <h4>Report</h4>
        <pre>{report}</pre>
        {stage?.artifacts?.compare_url && (
          <div className="compare">
            <a href={stage.artifacts.compare_url} target="_blank" rel="noreferrer">Compare URL</a>
          </div>
        )}
        <div className="logs">
          <details>
            <summary>Unit Log</summary>
            <pre>{logs.unit || 'No unit log'}</pre>
          </details>
          <details>
            <summary>QA Log</summary>
            <pre>{logs.qa || 'No qa log'}</pre>
          </details>
          <details>
            <summary>E2E Log</summary>
            <pre>{logsE2E || 'No e2e log'}</pre>
          </details>
          {qaIssues.length > 0 && (
            <details open>
              <summary>QA Issues</summary>
              <ul>
                {qaIssues.map((i: any, idx: number) => (
                  <li key={idx}>{i.severity ? `[${i.severity}] ` : ''}{i.description || i}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const { items, load, loading } = useRequests();
  const [selected, setSelected] = useState<any | null>(null);

  const select = async (id: string) => {
    const data = await api(`/api/requests/${id}`);
    setSelected(data);
  };

  return (
    <div className="app">
      <aside>
        <div className="aside-header">
          <h2>Requests</h2>
          <button onClick={load}>{loading ? '...' : 'Reload'}</button>
        </div>
        <div className="list">
          {items.map((r) => (
            <button key={r.id} className={`list-item ${selected?.id === r.id ? 'active' : ''}`} onClick={() => select(r.id)}>
              <div className="title">{r.title}</div>
              <div className="meta">{r.priority} · {r.status}</div>
            </button>
          ))}
        </div>
      </aside>
      <main>
        <RequestEditor request={selected} onSave={setSelected} />
        <RunPanel requestId={selected?.id || null} />
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
