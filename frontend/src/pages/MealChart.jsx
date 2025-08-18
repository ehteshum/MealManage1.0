import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { todayISOInTZ, formatTimeInTZ, isAfterHourInTZ } from '../lib/formatters';

export default function MealChart() {
  const [dinnerDate, setDinnerDate] = useState(todayISOInTZ());
  const lunchDate = useMemo(() => {
    const iso = dinnerDate;
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }, [dinnerDate]);

  const [members, setMembers] = useState([]);
  const [meals, setMeals] = useState([]); // only the two dates of interest
  const [error, setError] = useState('');

  const fetchData = async (dd, ld) => {
    setError('');
    try {
      const memReq = supabase.from('members').select('*');
      const mealsReq = supabase
        .from('meals')
        .select('id, member_id, meal_count, date, created_at')
        .in('date', [dd, ld].filter(Boolean));
      const [memRes, mealsRes] = await Promise.all([memReq, mealsReq]);
      if (memRes.error) throw memRes.error;
      if (mealsRes.error) {
        // If created_at column doesn't exist, retry without it
        if ((mealsRes.error.message || '').toLowerCase().includes('created_at')) {
          const mealsRes2 = await supabase
            .from('meals')
            .select('id, member_id, meal_count, date')
            .in('date', [dd, ld].filter(Boolean));
          if (mealsRes2.error) throw mealsRes2.error;
          setMembers(memRes.data || []);
          setMeals(mealsRes2.data || []);
        } else {
          throw mealsRes.error;
        }
      } else {
        setMembers(memRes.data || []);
        setMeals(mealsRes.data || []);
      }
    } catch (e) {
      setError(e.message || 'Failed to load meal chart.');
      setMembers([]);
      setMeals([]);
    }
  };

  useEffect(() => {
    fetchData(dinnerDate, lunchDate);
    // realtime: refetch on meal changes impacting our dates
    const channel = supabase
      .channel('mealchart')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, (payload) => {
        const rec = payload.new || payload.old || {};
        const date = rec.date?.slice(0, 10);
        if (date === dinnerDate || date === lunchDate) {
          fetchData(dinnerDate, lunchDate);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dinnerDate, lunchDate]);

  const rows = useMemo(() => {
    const nameById = new Map();
    for (const m of members) nameById.set(m.id, m.name || m.email || 'Unnamed');
    const map = new Map(); // member_id -> { name, dinner, lunch, dinnerTime, lunchTime, dinnerLate, lunchLate }
    for (const m of members) {
      map.set(m.id, { name: nameById.get(m.id), dinner: 0, lunch: 0, dinnerTime: null, lunchTime: null, dinnerLate: false, lunchLate: false });
    }
    for (const r of meals) {
      const key = r.member_id;
      if (!map.has(key)) map.set(key, { name: nameById.get(key) || 'Unknown', dinner: 0, lunch: 0, dinnerTime: null, lunchTime: null, dinnerLate: false, lunchLate: false });
      const d = (r.date || '').slice(0, 10);
      const val = Number(r.meal_count) || 0;
      if (d === dinnerDate) {
        map.get(key).dinner += val;
        // keep the latest created_at time for display
        if (r.created_at) {
          map.get(key).dinnerTime = r.created_at;
          map.get(key).dinnerLate = isAfterHourInTZ(r.created_at, 18, 'Asia/Dhaka');
        }
      } else if (d === lunchDate) {
        map.get(key).lunch += val;
        if (r.created_at) {
          map.get(key).lunchTime = r.created_at;
          map.get(key).lunchLate = isAfterHourInTZ(r.created_at, 18, 'Asia/Dhaka');
        }
      }
    }
    const arr = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return arr;
  }, [members, meals, dinnerDate, lunchDate]);

  const totals = useMemo(() => {
    let dinner = 0, lunch = 0;
    for (const r of rows) { dinner += r.dinner; lunch += r.lunch; }
    const all = dinner + lunch;
    return { dinner, lunch, all };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dinner date</label>
          <input
            type="date"
            value={dinnerDate}
            onChange={(e) => setDinnerDate(e.target.value)}
            className="border p-2 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Lunch date (auto)</label>
          <input
            type="date"
            value={lunchDate}
            readOnly
            disabled
            className="border p-2 rounded bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
          />
        </div>
      </div>

  {error && <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Meal Chart</h2>
        </div>
  <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Name','Dinner','Lunch'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{r.name}</td>
                  <td className={`px-4 py-3 text-sm ${r.dinnerLate ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {r.dinner || 0}
                    {r.dinnerLate && r.dinnerTime && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatTimeInTZ(r.dinnerTime, 'Asia/Dhaka')}</div>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-sm ${r.lunchLate ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {r.lunch || 0}
                    {r.lunchLate && r.lunchTime && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatTimeInTZ(r.lunchTime, 'Asia/Dhaka')}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Total</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{totals.dinner}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{totals.lunch}</td>
              </tr>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Total (Dinner + Lunch)</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">—</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{totals.all}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
