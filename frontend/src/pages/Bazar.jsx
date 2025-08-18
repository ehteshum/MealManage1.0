import { useEffect, useState } from 'react';
import { Input } from "@material-tailwind/react";
import { supabase } from '../lib/supabaseClient';
import { formatDateWithDay, todayISOInTZ } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';

export default function Bazar() {
  const { member } = useAuth();
  const [itemName, setItemName] = useState('');
  const [cost, setCost] = useState('');
  const [bazar, setBazar] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISOInTZ());
  const [paidFrom, setPaidFrom] = useState('box'); // 'box' | 'user'
  const [editingId, setEditingId] = useState(null);
  const [editItemName, setEditItemName] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editDate, setEditDate] = useState(todayISOInTZ());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editPaidFrom, setEditPaidFrom] = useState('box');
  const [originalPaidFrom, setOriginalPaidFrom] = useState('box');

  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      if (!member) { setBazar([]); return; }
      const { data: rows, error: fetchErr } = await supabase
        .from('bazar')
        .select('*')
        .eq('member_id', member.id);
      if (!active) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setBazar([]);
      } else {
  const sorted = (rows || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
        setBazar(sorted);
      }
    })();
    return () => { active = false; };
  }, [member]);

  const addBazarItem = async () => {
    setError('');
  if (!itemName || !cost || !member) return;
    setAdding(true);
  const payload = [{ member_id: member.id, item_name: itemName, cost: Number(cost), date: selectedDate, paid_from: paidFrom }];
    let data, insertErr;
    {
      const res = await supabase.from('bazar').insert(payload).select();
      data = res.data; insertErr = res.error;
    }
    if (insertErr && String(insertErr.message || '').toLowerCase().includes('paid_from')) {
      // Retry without paid_from for backward compatibility
      const res2 = await supabase
        .from('bazar')
        .insert([{ member_id: member.id, item_name: itemName, cost: Number(cost), date: selectedDate }])
        .select();
      data = res2.data; insertErr = res2.error;
      if (!insertErr) {
        setError("Your database is missing the 'paid_from' column. Inserted without it. Please run the migration.");
      }
    }
    setAdding(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    const inserted = (data || [])[0];
    // If paid by user, also insert a matching deposit
    if (paidFrom === 'user' && inserted) {
      const { error: depErr } = await supabase
        .from('deposits')
        .insert([{ member_id: member.id, amount: Number(cost), date: selectedDate }]);
      if (depErr) {
        // Try to rollback the bazar insert to keep data consistent
        await supabase.from('bazar').delete().eq('id', inserted.id);
        setError(`Bazar saved but deposit failed: ${depErr.message}`);
        return;
      }
    }
  const merged = [...bazar, ...(data || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
    setBazar(merged);
    setItemName('');
    setCost('');
  };

  const startEdit = (row) => {
    setError('');
    setEditingId(row.id);
    setEditItemName(row.item_name || '');
    setEditCost(String(row.cost ?? ''));
  setEditDate(row.date ? row.date.slice(0,10) : todayISOInTZ());
    const pf = row.paid_from === 'user' ? 'user' : 'box';
    setEditPaidFrom(pf);
    setOriginalPaidFrom(pf);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditItemName('');
    setEditCost('');
  setEditDate(todayISOInTZ());
  };

  const saveEdit = async () => {
    if (!editingId || !member) return;
    setError('');
    setSaving(true);
    const updates = { item_name: editItemName, cost: Number(editCost), date: editDate, paid_from: editPaidFrom };
    let data, upErr;
    {
      const res = await supabase
      .from('bazar')
      .update(updates)
      .eq('id', editingId)
      .eq('member_id', member.id)
      .select();
      data = res.data; upErr = res.error;
    }
    if (upErr && String(upErr.message || '').toLowerCase().includes('paid_from')) {
      // Retry without paid_from; warn user that field wasn't changed
      const res2 = await supabase
        .from('bazar')
        .update({ item_name: editItemName, cost: Number(editCost), date: editDate })
        .eq('id', editingId)
        .eq('member_id', member.id)
        .select();
      data = res2.data; upErr = res2.error;
      if (!upErr) {
        setError("'paid_from' column missing; updated other fields only. Please migrate your DB.");
      }
    }
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    const updated = data && data[0];
    if (!updated) { cancelEdit(); return; }

    // Adjust deposits if paid_from changed
    try {
      if (originalPaidFrom !== editPaidFrom && data && data[0] && data[0].paid_from !== undefined) {
        if (editPaidFrom === 'user') {
          // add deposit
          const { error: depErr } = await supabase
            .from('deposits')
            .insert([{ member_id: member.id, amount: Number(editCost), date: editDate }]);
          if (depErr) throw depErr;
        } else if (originalPaidFrom === 'user' && editPaidFrom === 'box') {
          // remove a matching deposit (best-effort)
          await supabase
            .from('deposits')
            .delete()
            .eq('member_id', member.id)
            .eq('amount', Number(editCost))
            .eq('date', editDate);
        }
      }
      const next = bazar.map(r => r.id === editingId ? updated : r)
        .sort((a,b) => new Date(b.date) - new Date(a.date));
      setBazar(next);
      cancelEdit();
    } catch (e) {
      // Try to revert bazar update if deposit adjustment failed
      await supabase
        .from('bazar')
        .update({ paid_from: originalPaidFrom })
        .eq('id', editingId)
        .eq('member_id', member.id);
      setError(e.message);
    }
  };

  const deleteRow = async (id) => {
    if (!member) return;
    const ok = window.confirm('Delete this bazar item?');
    if (!ok) return;
    setError('');
    setDeletingId(id);
    const { error: delErr } = await supabase
      .from('bazar')
      .delete()
      .eq('id', id)
      .eq('member_id', member.id);
    setDeletingId(null);
    if (delErr) { setError(delErr.message); return; }
    setBazar(bazar.filter(r => r.id !== id));
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Add Bazar Item</h2>
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
      <div className="mb-2">
        <select
          value={paidFrom}
          onChange={(e) => setPaidFrom(e.target.value)}
          className="border p-2 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="box">Paid From: Meal Box</option>
          <option value="user">Paid From: User</option>
        </select>
      </div>
  <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
  <div className="w-60"><Input type="text" label="Item name" value={itemName} onChange={(e)=>setItemName(e.target.value)} crossOrigin="anonymous"/></div>
  <div className="w-44 mr-3"><Input type="number" label="Cost" value={cost} onChange={(e)=>setCost(e.target.value)} crossOrigin="anonymous"/></div>
  <button
          onClick={addBazarItem}
          disabled={adding || !member}
          className={`shrink-0 ml-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ${adding ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>

  {error && (<div className="mt-3 text-sm text-red-600">{error}</div>)}

  <h3 className="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-gray-100">Recent Bazar</h3>
  <div className="overflow-x-auto">
  <table className="min-w-full table-auto border dark:border-gray-800">
        <thead>
          <tr>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Date</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Item</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Cost</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Paid From</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bazar.map((row) => (
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
                  <Input type="text" label="Item" value={editItemName} onChange={(e)=>setEditItemName(e.target.value)} crossOrigin="anonymous"/>
                ) : (
                  row.item_name || row.item || row.name
                )}
              </td>
      <td className="border px-2 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                {editingId === row.id ? (
                  <Input type="number" label="Cost" value={editCost} onChange={(e)=>setEditCost(e.target.value)} crossOrigin="anonymous"/>
                ) : (
                  `${Number(row.cost).toFixed(2)} taka`
                )}
              </td>
      <td className="border px-2 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                {editingId === row.id ? (
                  <select
                    value={editPaidFrom}
                    onChange={(e) => setEditPaidFrom(e.target.value)}
        className="border p-1 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="box">Meal Box</option>
                    <option value="user">User</option>
                  </select>
                ) : (
                  row.paid_from === 'user' ? 'User' : 'Meal Box'
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
