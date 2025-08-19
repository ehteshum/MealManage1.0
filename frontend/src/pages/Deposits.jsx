import { useEffect, useState } from 'react';
import { Input } from "@material-tailwind/react";
import { supabase } from '../lib/supabaseClient';
import { formatDateWithDay, todayISOInTZ } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { logAction } from '../lib/audit';
import { EditIcon, TrashIcon } from '../components/ui/Icons';

export default function Deposits() {
  const { member } = useAuth();
  const [amount, setAmount] = useState('');
  const [deposits, setDeposits] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISOInTZ());
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState(todayISOInTZ());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      if (!member) { setDeposits([]); return; }
      const { data: rows, error: fetchErr } = await supabase
        .from('deposits')
        .select('*')
        .eq('member_id', member.id);
      if (!active) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setDeposits([]);
      } else {
  const sorted = (rows || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
        setDeposits(sorted);
      }
    })();
    return () => { active = false; };
  }, [member]);

  const addDeposit = async () => {
    setError('');
    if (!amount || !member) return;
    setAdding(true);
  const payload = [{ member_id: member.id, amount: Number(amount), date: selectedDate }];
    const { data, error: insertErr } = await supabase.from('deposits').insert(payload).select();
    setAdding(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    for (const row of data || []) {
      logAction({ table: 'deposits', action: 'create', rowId: row.id, before: null, after: row, member });
    }
  const merged = [...deposits, ...(data || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
    setDeposits(merged);
    setAmount('');
  };

  const startEdit = (row) => {
    setError('');
    setEditingId(row.id);
    setEditAmount(String(row.amount ?? ''));
  setEditDate(row.date ? row.date.slice(0,10) : todayISOInTZ());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount('');
  setEditDate(todayISOInTZ());
  };

  const saveEdit = async () => {
    if (!editingId || !member) return;
    setError('');
    setSaving(true);
    const updates = { amount: Number(editAmount), date: editDate };
  const prev = deposits.find(r => r.id === editingId) || null;
  const { data, error: upErr } = await supabase
      .from('deposits')
      .update(updates)
      .eq('id', editingId)
      .eq('member_id', member.id)
      .select();
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    const updated = data && data[0];
    if (updated) {
      const next = deposits.map(r => r.id === editingId ? updated : r)
  .sort((a,b) => new Date(b.date) - new Date(a.date));
      setDeposits(next);
      logAction({ table: 'deposits', action: 'update', rowId: updated.id, before: prev, after: updated, member });
    }
    cancelEdit();
  };

  const deleteRow = async (id) => {
    if (!member) return;
    const ok = window.confirm('Delete this deposit?');
    if (!ok) return;
    setError('');
    setDeletingId(id);
  const prev = deposits.find(r => r.id === id) || null;
  const { error: delErr } = await supabase
      .from('deposits')
      .delete()
      .eq('id', id)
      .eq('member_id', member.id);
    setDeletingId(null);
    if (delErr) { setError(delErr.message); return; }
  setDeposits(deposits.filter(r => r.id !== id));
  logAction({ table: 'deposits', action: 'delete', rowId: id, before: prev, after: null, member });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Add Deposit</h2>
      {!member && (
        <div className="mb-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
          Your member profile isn’t ready yet. Please refresh after signup verification.
        </div>
      )}
      <div className="mb-2">
        <label className="mr-2 text-gray-800 dark:text-gray-300">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-2 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
  <div className="w-48 sm:w-56 inline-block mr-2"><Input type="number" label="Amount" value={amount} onChange={(e)=>setAmount(e.target.value)} crossOrigin="anonymous"/></div>
  <Button
        onClick={addDeposit}
        disabled={adding || !member}
        variant="primary"
      >
        {adding ? 'Adding...' : 'Add'}
      </Button>

      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

  <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 mt-6">
    <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Deposits</h3>
    </div>
    <div className="overflow-x-auto">
  <table className="min-w-[520px] table-auto divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-3 sm:px-4 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
            <th className="px-3 sm:px-4 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
            <th className="px-3 sm:px-4 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {deposits.map((row) => (
    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
  <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900">
                {editingId === row.id ? (
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
        className="border p-1 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  formatDateWithDay(row.date)
                )}
              </td>
  <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                {editingId === row.id ? (
                  <Input type="number" label="Amount" value={editAmount} onChange={(e)=>setEditAmount(e.target.value)} crossOrigin="anonymous"/>
                ) : (
                  `${Number(row.amount).toFixed(2)} taka`
                )}
              </td>
  <td className="px-3 sm:px-4 py-3">
                {editingId === row.id ? (
                  <div className="flex gap-2">
                    <Button onClick={saveEdit} disabled={saving} variant="success" size="sm">
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button onClick={cancelEdit} variant="outline" size="sm">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => startEdit(row)} variant="warning" size="icon" aria-label="Edit" title="Edit" disabled={!member} className="rounded-full">
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => deleteRow(row.id)} variant="danger" size="icon" aria-label="Delete" title="Delete" disabled={deletingId === row.id || !member} className="rounded-full">
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
    </div>
  );
}
