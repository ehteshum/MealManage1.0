import { useEffect, useState } from 'react';
import { Input } from "@material-tailwind/react";
import { supabase } from '../lib/supabaseClient';
import { formatDateWithDay, todayISOInTZ } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';

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
    }
    cancelEdit();
  };

  const deleteRow = async (id) => {
    if (!member) return;
    const ok = window.confirm('Delete this deposit?');
    if (!ok) return;
    setError('');
    setDeletingId(id);
    const { error: delErr } = await supabase
      .from('deposits')
      .delete()
      .eq('id', id)
      .eq('member_id', member.id);
    setDeletingId(null);
    if (delErr) { setError(delErr.message); return; }
    setDeposits(deposits.filter(r => r.id !== id));
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Add Deposit</h2>
      {!member && (
        <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
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
  <div className="w-56 inline-block mr-2"><Input type="number" label="Amount" value={amount} onChange={(e)=>setAmount(e.target.value)} crossOrigin="anonymous"/></div>
  <button
        onClick={addDeposit}
        disabled={adding || !member}
        className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ${adding ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {adding ? 'Adding...' : 'Add'}
      </button>

      {error && (
        <div className="mt-3 text-sm text-red-600">{error}</div>
      )}

  <h3 className="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-gray-100">Recent Deposits</h3>
  <div className="overflow-x-auto">
  <table className="min-w-full table-auto border dark:border-gray-800">
        <thead>
          <tr>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Date</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Amount</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody>
          {deposits.map((row) => (
            <tr key={row.id}>
      <td className="border px-2 dark:border-gray-800 text-gray-900 dark:text-gray-100">
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
      <td className="border px-2 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                {editingId === row.id ? (
                  <Input type="number" label="Amount" value={editAmount} onChange={(e)=>setEditAmount(e.target.value)} crossOrigin="anonymous"/>
                ) : (
                  `${Number(row.amount).toFixed(2)} taka`
                )}
              </td>
      <td className="border px-2 dark:border-gray-800">
                {editingId === row.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className={`bg-green-600 text-white px-3 py-1 rounded ${saving ? 'opacity-60' : ''}`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
          className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(row)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded"
                      disabled={!member}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded"
                      disabled={deletingId === row.id || !member}
                    >
                      {deletingId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
  </table>
  </div>
    </div>
  );
}
