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
  const [running, setRunning] = useState(false);

  const loadLatest = async () => {
    if (!requestId) return;
    try {
      const latest = await api(`/api/requests/${requestId}/runs/latest`);
      const runId = latest.run.run_id;
      const stageResp = await api(`/api/requests/${requestId}/runs/${runId}/stage`);
      setStage(stageResp.stage);
      try {
        const reportText = await api(`/api/requests/${requestId}/runs/${runId}/report`);
        setReport(typeof reportText === 'string' ? reportText : '');
      } catch (e) {
        setReport('');
      }
    } catch {
      setStage(null);
      setReport('');
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
    loadLatest();
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
        </div>
      ) : (
        <div>No run yet.</div>
      )}
      <div className="report">
        <h4>Report</h4>
        <pre>{report}</pre>
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
