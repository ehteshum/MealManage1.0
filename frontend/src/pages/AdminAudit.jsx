import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function AdminAudit() {
  const { user } = useAuth();
  const isAdmin = (user?.email || '').toLowerCase() === 'ishmam@manager.com';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [onlyMealChart, setOnlyMealChart] = useState(true);
  const [emailQuery, setEmailQuery] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

  if (tableFilter) query = query.eq('table_name', tableFilter);
      if (actionFilter) query = query.eq('action', actionFilter);
      if (emailQuery) query = query.ilike('actor_email', `%${emailQuery}%`);
  if (onlyMealChart) query = query.eq('source', 'meal_chart');

      const { data, error: err } = await query;
      if (err) throw err;
      setRows(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const deleteOne = async (id) => {
    if (!isAdmin || !id) return;
    const ok = window.confirm('Delete this log entry? This cannot be undone.');
    if (!ok) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase.from('audit_logs').delete().eq('id', id);
      if (delErr) throw delErr;
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setError(e.message || 'Failed to delete log.');
    } finally {
      setDeleting(false);
    }
  };

  const deleteFiltered = async () => {
    if (!isAdmin) return;
    const ok = window.confirm('Delete ALL logs matching current filters? This cannot be undone.');
    if (!ok) return;
    setDeleting(true);
    try {
      let query = supabase.from('audit_logs').delete();
      if (tableFilter) query = query.eq('table_name', tableFilter);
      if (actionFilter) query = query.eq('action', actionFilter);
      if (emailQuery) query = query.ilike('actor_email', `%${emailQuery}%`);
      if (onlyMealChart) query = query.eq('source', 'meal_chart');
      const { error: delErr } = await query;
      if (delErr) throw delErr;
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete filtered logs.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => { load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableFilter, actionFilter]);

  const tables = useMemo(() => Array.from(new Set(rows.map(r => r.table_name))).sort(), [rows]);
  const actions = ['create', 'update', 'delete'];

  if (!isAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Audit Logs</h1>
        <div className="flex items-center gap-2">
          <Button onClick={load} disabled={loading} variant="outline" size="md">{loading ? 'Loading…' : 'Refresh'}</Button>
          <Button onClick={deleteFiltered} disabled={loading || deleting} variant="danger" size="md">{deleting ? 'Deleting…' : 'Delete filtered'}</Button>
        </div>
      </div>

  <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm text-gray-600">Table</label>
          <select value={tableFilter} onChange={e=>setTableFilter(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2">
            <option value="">All</option>
            {['meals','bazar','deposits', ...tables.filter(t=>!['meals','bazar','deposits'].includes(t))].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Action</label>
          <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2">
            <option value="">All</option>
            {actions.map(a => (<option key={a} value={a}>{a}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Actor email</label>
          <div className="flex gap-2">
            <input value={emailQuery} onChange={e=>setEmailQuery(e.target.value)} placeholder="search email" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2" />
            <Button onClick={load} disabled={loading} variant="secondary" size="md" className="mt-1">Search</Button>
          </div>
        </div>
        <div className="sm:col-span-3 flex items-center gap-2">
          <input id="onlyMealChart" type="checkbox" checked={onlyMealChart} onChange={e=>setOnlyMealChart(e.target.checked)} />
          <label htmlFor="onlyMealChart" className="text-sm text-gray-700">Show Meal Chart edits only</label>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Table</th>
              <th className="py-2 pr-3">Row ID</th>
              <th className="py-2 pr-3">Actor</th>
              <th className="py-2 pr-3">Details</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-3 whitespace-nowrap" title={r.created_at}>{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.action==='delete'?'bg-red-100 text-red-800': r.action==='update'?'bg-amber-100 text-amber-800':'bg-green-100 text-green-800'}`}>{r.action}</span>
                </td>
                <td className="py-2 pr-3">{r.table_name}</td>
                <td className="py-2 pr-3">{r.row_id || '-'}</td>
                <td className="py-2 pr-3">{r.actor_email || '-'}</td>
                <td className="py-2 pr-3 max-w-[28rem]">
                  <details>
                    <summary className="cursor-pointer text-blue-600">view</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Before</div>
                        <pre className="text-xs bg-gray-100 rounded p-2 overflow-auto max-h-60">{JSON.stringify(r.before, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">After</div>
                        <pre className="text-xs bg-gray-100 rounded p-2 overflow-auto max-h-60">{JSON.stringify(r.after, null, 2)}</pre>
                      </div>
                    </div>
                  </details>
                </td>
                <td className="py-2 pr-3">
                  <Button onClick={() => deleteOne(r.id)} disabled={deleting} variant="danger" size="sm">Delete</Button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">No audit logs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
