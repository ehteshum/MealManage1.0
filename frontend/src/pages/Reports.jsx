import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  // Period boundaries for the selected month
  const [period, setPeriod] = useState({ start: '', end: '' });
  // Selected month dropdown (YYYY-MM), default current month
  const todayInit = new Date();
  const defaultMonth = `${todayInit.getFullYear()}-${String(todayInit.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Fetch data across all members for the selected month
  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      // Compute [start, end] for the selected month (full calendar month)
      const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const [yStr, mStr] = selectedMonth.split('-');
      const y = Number(yStr);
      const m = Number(mStr) - 1; // 0-based month index
      const startDate = new Date(y, m, 1);
      const endDate = new Date(y, m + 1, 0);
      const startStr = toYMD(startDate);
      const endStr = toYMD(endDate);
      setPeriod({ start: startStr, end: endStr });

      const [membersRes, mealsRes, bazarRes, depRes] = await Promise.all([
        supabase.from('members').select('*'),
        supabase
          .from('meals')
          .select('id, member_id, meal_count, date')
          .gte('date', startStr)
          .lte('date', endStr),
        supabase
          .from('bazar')
          .select('id, member_id, item_name, cost, date')
          .gte('date', startStr)
          .lte('date', endStr),
        supabase
          .from('deposits')
          .select('id, member_id, amount, date')
          .gte('date', startStr)
          .lte('date', endStr),
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
  // Monthly sections compute their own totals and meal rate below.
      }
    })();
    return () => { active = false; };
  }, [selectedMonth]);

  // Month boundaries computed inline for queries in the effect

  // inMonth not needed after switching to month-bounded queries

  // For Reports: always show all members' data (no personal filtering)
  const mealsM = useMemo(() => meals, [meals]);
  const bazarM = useMemo(() => bazar, [bazar]);
  const depositsM = useMemo(() => deposits, [deposits]);

  // Aggregates: balance per-user is computed in ledger; overall balance unused

  // Per-member aggregates for the whole period are not needed; monthly sections compute per-month aggregates.

  const memberNameById = useMemo(() => {
    const map = new Map();
    for (const m of members) map.set(m.id, m.name || m.email || 'Unnamed');
    return map;
  }, [members]);

  // Sorted members for columns in the pivot table
  const membersSorted = useMemo(() => {
    return members.slice().sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
  }, [members]);

  // Removed unused all-range meal pivot and ledger; monthly sections compute their own.

  // Build list of calendar months between period.start and period.end (inclusive)
  const monthsInRange = useMemo(() => {
    if (!period.start || !period.end) return [];
    const start = new Date(period.start);
    const end = new Date(period.end);
    // Normalize to first/last day
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    const arr = [];
    while (cursor <= lastMonth) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      const label = startOfMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      arr.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label,
        startYMD: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        endYMD: `${year}-${String(month + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`,
        startDate: startOfMonth,
        endDate: endOfMonth,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return arr;
  }, [period]);

  

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reports</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {period.start && period.end ? `Month: ${formatDateWithDay(period.start)} → ${formatDateWithDay(period.end)}` : 'Select a month'}
            </p>
          </div>
          <div className="shrink-0">
            <label htmlFor="selectedMonth" className="mr-2 text-sm text-gray-700 dark:text-gray-300">Month</label>
            <select
              id="selectedMonth"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:text-gray-100 dark:bg-gray-900 dark:border-gray-700"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {(() => {
                const opts = [];
                const base = new Date();
                for (let i = 0; i < 12; i++) {
                  const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
                  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                  opts.push(<option key={ym} value={ym}>{label}</option>);
                }
                return opts;
              })()}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {/* Per-month sections */}
      {monthsInRange.map((m) => {
        // Filter arrays for this calendar month
        const mealsMonth = mealsM.filter(r => r.date && r.date >= m.startYMD && r.date <= m.endYMD);
        const bazarMonth = bazarM.filter(r => r.date && r.date >= m.startYMD && r.date <= m.endYMD);
        const depositsMonth = depositsM.filter(r => r.date && r.date >= m.startYMD && r.date <= m.endYMD);

        // Monthly totals and meal rate
        const totalMeals = mealsMonth.reduce((s, r) => s + (Number(r.meal_count) || 0), 0);
        const totalBazar = bazarMonth.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        const totalDeposits = depositsMonth.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;

        // Monthly per-member aggregates for ledger
        const mealsByMemberMonth = new Map();
        for (const r of mealsMonth) mealsByMemberMonth.set(r.member_id, (mealsByMemberMonth.get(r.member_id) || 0) + (Number(r.meal_count) || 0));
        const depositsByMemberMonth = new Map();
        for (const r of depositsMonth) depositsByMemberMonth.set(r.member_id, (depositsByMemberMonth.get(r.member_id) || 0) + (Number(r.amount) || 0));
        const ledgerMonth = members.map((mem) => {
          const mMeals = mealsByMemberMonth.get(mem.id) || 0;
          const mDeposits = depositsByMemberMonth.get(mem.id) || 0;
          const mFair = mMeals * mealRate;
          return {
            memberId: mem.id,
            name: mem.name || mem.email || 'Unnamed',
            meals: mMeals,
            deposits: mDeposits,
            fairShare: mFair,
            net: mDeposits - mFair,
          };
        }).sort((a,b) => a.name.localeCompare(b.name));

        // Monthly meal pivot
        const byDate = new Map();
        for (const r of mealsMonth) {
          const day = (r.date || '').slice(0, 10);
          if (!day) continue;
          if (!byDate.has(day)) byDate.set(day, new Map());
          const inner = byDate.get(day);
          inner.set(r.member_id, (inner.get(r.member_id) || 0) + (Number(r.meal_count) || 0));
        }
        const mealPivotMonth = Array.from(byDate.entries()).map(([day, counts]) => ({ day, counts }))
          .sort((a, b) => new Date(a.day) - new Date(b.day));

        return (
          <div key={m.key} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{m.label}</h2>
            </div>

            {/* Monthly summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Meals" value={totalMeals} />
              <StatCard title="Total Bazar" value={`${totalBazar.toFixed(2)} taka`} />
              <StatCard title="Total Deposits" value={`${totalDeposits.toFixed(2)} taka`} />
              <StatCard title="Meal Rate" value={totalMeals ? `${mealRate.toFixed(2)} taka` : '—'} />
            </div>

            {/* Bazar list (month) */}
            <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bazar</h3>
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
                    {bazarMonth
                      .slice()
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDateWithDay(row.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{memberNameById.get(row.member_id) || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.item_name ?? row.item ?? row.name ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{Number(row.cost).toFixed(2)} taka</td>
                        </tr>
                      ))}
                    {bazarMonth.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No bazar entries</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Meal entries (month) - pivot */}
            <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Meal Count</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      {membersSorted.map((mem) => (
                        <th key={mem.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{mem.name || mem.email || 'Unnamed'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {mealPivotMonth.map((row) => (
                      <tr key={row.day} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDateWithDay(row.day)}</td>
                        {membersSorted.map((mem) => {
                          const val = row.counts.get(mem.id) || '';
                          return (
                            <td key={`${row.day}-${mem.id}`} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{val || ''}</td>
                          );
                        })}
                      </tr>
                    ))}
                    {mealPivotMonth.length === 0 && (
                      <tr>
                        <td colSpan={1 + membersSorted.length} className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No meal entries</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Deposits (month) */}
            <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Deposits</h3>
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
                    {depositsMonth
                      .slice()
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatDateWithDay(row.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{memberNameById.get(row.member_id) || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{Number(row.amount).toFixed(2)} taka</td>
                        </tr>
                      ))}
                    {depositsMonth.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No deposit entries</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ledger (month) */}
            <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ledger</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Meal rate: {totalMeals ? `${mealRate.toFixed(4)} taka` : '—'}</p>
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
                    {ledgerMonth.map((row) => (
                      <tr key={row.memberId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.meals}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{totalMeals ? `${mealRate.toFixed(4)} taka` : '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.fairShare.toFixed(2)} taka</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.deposits.toFixed(2)} taka</td>
                        <td className={`px-4 py-3 text-sm ${row.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{row.net >= 0 ? '' : '-'}{Math.abs(row.net).toFixed(2)} taka</td>
                      </tr>) )}
                    {ledgerMonth.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
