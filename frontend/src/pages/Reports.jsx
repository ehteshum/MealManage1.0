import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchGlobalAggregates } from '../lib/aggregates';
import { formatDateWithDay } from '../lib/formatters';

function StatCard({ title, value }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 p-5 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

export default function Reports() {
  const [members, setMembers] = useState([]);
  const [meals, setMeals] = useState([]);
  const [bazar, setBazar] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [error, setError] = useState('');
  const [globalTotals, setGlobalTotals] = useState({ meals: 0, bazar: 0, deposits: 0, mealRate: 0 });
  const [monthTotalBazar, setMonthTotalBazar] = useState(0);

  // Fetch all-time data across all members
  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
  const [membersRes, mealsRes, bazarRes, depRes, globalAgg] = await Promise.all([
        supabase.from('members').select('*'),
        supabase.from('meals').select('id, member_id, meal_count, date'),
        supabase.from('bazar').select('id, member_id, item_name, cost, date'),
        supabase.from('deposits').select('id, member_id, amount, date'),
        fetchGlobalAggregates(supabase),
      ]);
      if (!active) return;
  const err = membersRes.error || mealsRes.error || bazarRes.error || depRes.error;
      if (err) {
        setError(err.message);
        setMembers([]); setMeals([]); setBazar([]); setDeposits([]);
      } else {
        setMembers(membersRes.data || []);
        setMeals(mealsRes.data || []);
        setBazar(bazarRes.data || []);
        setDeposits(depRes.data || []);
        setGlobalTotals({
          meals: globalAgg.totalMealsAll || 0,
          bazar: globalAgg.totalBazarAll || 0,
          deposits: globalAgg.totalDepositsAll || 0,
          mealRate: globalAgg.mealRate || 0,
        });
        // compute current month total bazar
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 1);
        const monthTotal = (bazarRes.data || [])
          .filter(r => {
            const d = new Date(r.date);
            return d >= start && d < end;
          })
          .reduce((s, r) => s + (Number(r.cost) || 0), 0);
        setMonthTotalBazar(monthTotal);
      }
    })();
    return () => { active = false; };
  }, []);

  // Month boundaries computed inline for queries in the effect

  // inMonth not needed after switching to month-bounded queries

  // For Reports: always show all members' data (no personal filtering)
  const mealsM = useMemo(() => meals, [meals]);
  const bazarM = useMemo(() => bazar, [bazar]);
  const depositsM = useMemo(() => deposits, [deposits]);

  // Aggregates: balance per-user is computed in ledger; overall balance unused

  // Per-member aggregates
  const mealsByMember = useMemo(() => {
    const map = new Map();
    for (const r of mealsM) map.set(r.member_id, (map.get(r.member_id) || 0) + (Number(r.meal_count) || 0));
    return map;
  }, [mealsM]);
  const depositsByMember = useMemo(() => {
    const map = new Map();
    for (const r of depositsM) map.set(r.member_id, (map.get(r.member_id) || 0) + (Number(r.amount) || 0));
    return map;
  }, [depositsM]);

  const memberNameById = useMemo(() => {
    const map = new Map();
    for (const m of members) map.set(m.id, m.name || m.email || 'Unnamed');
    return map;
  }, [members]);

  // Sorted members for columns in the pivot table
  const membersSorted = useMemo(() => {
    return members.slice().sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
  }, [members]);

  // Build a pivot: rows = dates, columns = members, value = meal count
  const mealPivot = useMemo(() => {
    const byDate = new Map(); // day(YYYY-MM-DD) -> Map(member_id -> count)
    for (const r of mealsM) {
      const day = (r.date || '').slice(0, 10);
      if (!day) continue;
      if (!byDate.has(day)) byDate.set(day, new Map());
      const inner = byDate.get(day);
      inner.set(r.member_id, (inner.get(r.member_id) || 0) + (Number(r.meal_count) || 0));
    }
    const rows = Array.from(byDate.entries()).map(([day, counts]) => ({ day, counts }));
    rows.sort((a, b) => new Date(a.day) - new Date(b.day)); // ascending by date
    return rows;
  }, [mealsM]);

  const ledger = useMemo(() => {
    return members.map((m) => {
      const mMeals = mealsByMember.get(m.id) || 0;
      const mDeposits = depositsByMember.get(m.id) || 0;
      const mFairShare = mMeals * (globalTotals.mealRate || 0);
      const mNet = mDeposits - mFairShare;
      return {
        memberId: m.id,
        name: m.name || m.email || 'Unnamed',
        meals: mMeals,
        deposits: mDeposits,
        fairShare: mFairShare,
        net: mNet,
      };
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [members, mealsByMember, depositsByMember, globalTotals.mealRate]);

  

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-600">All-time summary and details.</p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      

    {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard title="Total Meals (Global)" value={globalTotals.meals} />
  <StatCard title="Total Bazar (This Month)" value={`${monthTotalBazar.toFixed(2)} taka`} />
  <StatCard title="Total Deposits (Global)" value={`${globalTotals.deposits.toFixed(2)} taka`} />
  <StatCard title="Meal Rate (Global)" value={globalTotals.meals ? `${globalTotals.mealRate.toFixed(2)} taka` : '—'} />
      </div>

  {/* Personal debit/credit removed: reports show global/all members only */}

  {/* Bazar list (all members) */}
  <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between p-4 border-b">
  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bazar List (All Members)</h2>
        </div>
  <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
    <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
        {['Date','Member','Item','Cost'].map((h) => (
      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {bazarM
                .slice()
                .sort((a, b) => {
                  const ta = a?.date ? new Date(a.date).getTime() : 0;
                  const tb = b?.date ? new Date(b.date).getTime() : 0;
                  if (ta !== tb) return ta - tb; // ascending by date/time
                  // stable fallback by id
                  const ai = typeof a.id === 'number' ? a.id : String(a.id);
                  const bi = typeof b.id === 'number' ? b.id : String(b.id);
                  if (typeof ai === 'number' && typeof bi === 'number') return ai - bi;
                  return String(ai).localeCompare(String(bi));
                })
                .map((row) => (
        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDateWithDay(row.date)}</td>
  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{memberNameById.get(row.member_id) || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.item_name ?? row.item ?? row.name ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{Number(row.cost).toFixed(2)} taka</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meal entries (all members) - pivot table: rows=dates, columns=members */}
      <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Meal Count (All Members)</h2>
        </div>
  <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                {membersSorted.map((m) => (
                  <th key={m.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{m.name || m.email || 'Unnamed'}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {mealPivot.map((row) => {
                return (
                  <tr key={row.day} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDateWithDay(row.day)}</td>
                    {membersSorted.map((m) => {
                      const val = row.counts.get(m.id) || '';
                      return (
                        <td key={`${row.day}-${m.id}`} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{val || ''}</td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deposits (all members) */}
      <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between p-4 border-b">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Deposits (All Members)</h2>
        </div>
  <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
    <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Date','Member','Amount'].map((h) => (
      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {depositsM
                .slice()
                .sort((a, b) => {
                  const ta = a?.date ? new Date(a.date).getTime() : 0;
                  const tb = b?.date ? new Date(b.date).getTime() : 0;
                  if (ta !== tb) return ta - tb; // ascending by date/time
                  // stable fallback by id
                  const ai = typeof a.id === 'number' ? a.id : String(a.id);
                  const bi = typeof b.id === 'number' ? b.id : String(b.id);
                  if (typeof ai === 'number' && typeof bi === 'number') return ai - bi;
                  return String(ai).localeCompare(String(bi));
                })
                .map((row) => (
        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDateWithDay(row.date)}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{memberNameById.get(row.member_id) || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{Number(row.amount).toFixed(2)} taka</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

  {/* Ledger */}
  <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ledger (All Members)</h2>
    <p className="text-sm text-gray-600 dark:text-gray-400">Meal rate applies to everyone: {globalTotals.meals ? `${globalTotals.mealRate.toFixed(4)} taka` : '—'}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
    <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Member','Meals','Meal Rate','Fair Share','Deposits','Remaining Balance'].map((h) => (
      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {ledger.map((row) => (
        <tr key={row.memberId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.name}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.meals}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{globalTotals.meals ? `${globalTotals.mealRate.toFixed(4)} taka` : '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.fairShare.toFixed(2)} taka</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.deposits.toFixed(2)} taka</td>
      <td className={`px-4 py-3 text-sm ${row.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{row.net >= 0 ? '' : '-'}{Math.abs(row.net).toFixed(2)} taka</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
