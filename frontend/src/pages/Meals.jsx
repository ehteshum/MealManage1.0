import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateWithDay, todayISOInTZ } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';

export default function Meals() {
  const { member } = useAuth();
  const [mealCount, setMealCount] = useState('');
  const [meals, setMeals] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISOInTZ());
  const [editingId, setEditingId] = useState(null);
  const [editMealCount, setEditMealCount] = useState('');
  const [editDate, setEditDate] = useState(todayISOInTZ());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // fetch logged-in user and meals
  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
  if (!member) { setMeals([]); return; }
      const { data: rows, error: fetchErr } = await supabase
        .from('meals')
        .select('*')
        .eq('member_id', member.id);
      if (!active) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setMeals([]);
      } else {
  const sorted = (rows || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
        setMeals(sorted);
      }
    })();
    return () => { active = false; };
  }, [member]);

  // add meal
  const addMeal = async () => {
    setError('');
  if (!mealCount || !member) return;
    setAdding(true);
  const payload = [{ member_id: member.id, meal_count: Number(mealCount), date: selectedDate }];
    const { data, error: insertErr } = await supabase.from('meals').insert(payload).select();
    setAdding(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
  const merged = [...meals, ...(data || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
    setMeals(merged);
    setMealCount('');
  };

  const startEdit = (row) => {
    setError('');
    setEditingId(row.id);
    setEditMealCount(String(row.meal_count ?? ''));
  setEditDate(row.date ? row.date.slice(0,10) : todayISOInTZ());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMealCount('');
  setEditDate(todayISOInTZ());
  };

  const saveEdit = async () => {
    if (!editingId || !member) return;
    setError('');
    setSaving(true);
    const updates = { meal_count: Number(editMealCount), date: editDate };
    const { data, error: upErr } = await supabase
      .from('meals')
      .update(updates)
      .eq('id', editingId)
      .eq('member_id', member.id)
      .select();
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    const updated = data && data[0];
    if (updated) {
      const next = meals.map(m => m.id === editingId ? updated : m)
        .sort((a,b) => new Date(b.date) - new Date(a.date));
      setMeals(next);
    }
    cancelEdit();
  };

  const deleteMeal = async (id) => {
    if (!member) return;
    const ok = window.confirm('Delete this meal entry?');
    if (!ok) return;
    setError('');
    setDeletingId(id);
    const { error: delErr } = await supabase
      .from('meals')
      .delete()
      .eq('id', id)
      .eq('member_id', member.id);
    setDeletingId(null);
    if (delErr) { setError(delErr.message); return; }
    setMeals(meals.filter(m => m.id !== id));
  };

  return (
    <div className="p-6">
  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Add Meal</h2>
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
  <input
        type="number"
        value={mealCount}
        onChange={(e) => setMealCount(e.target.value)}
        placeholder="Number of meals"
        className="border p-2 rounded mr-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
      />
  <button
        onClick={addMeal}
        disabled={adding || !member}
        className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ${adding ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {adding ? 'Adding...' : 'Add'}
      </button>

      {error && (
        <div className="mt-3 text-sm text-red-600">
          {error}
        </div>
      )}

  <h3 className="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-gray-100">Recent Meals</h3>
  <table className="w-full table-auto border dark:border-gray-800">
        <thead>
          <tr>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Date</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Meal Count</th>
    <th className="border px-2 dark:border-gray-800 text-gray-700 dark:text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody>
          {meals.map((meal) => (
    <tr key={meal.id}>
      <td className="border px-2 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                {editingId === meal.id ? (
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
        className="border p-1 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  formatDateWithDay(meal.date)
                )}
              </td>
      <td className="border px-2 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                {editingId === meal.id ? (
                  <input
                    type="number"
                    value={editMealCount}
                    onChange={(e) => setEditMealCount(e.target.value)}
        className="border p-1 rounded w-24 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  meal.meal_count
                )}
              </td>
      <td className="border px-2 dark:border-gray-800">
                {editingId === meal.id ? (
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
                      onClick={() => startEdit(meal)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded"
                      disabled={!member}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMeal(meal.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded"
                      disabled={deletingId === meal.id || !member}
                    >
                      {deletingId === meal.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
