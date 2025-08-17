// Create a Dashboard page for the Meal Management System using React and Tailwind CSS.
// Show summary cards for:
// 1. Total Meals
// 2. Total Bazar Cost
// 3. Total Deposits
// 4. Remaining Balance
// Each card should have a title, icon, and value (use placeholder numbers for now).
// Below the cards, create a table showing recent meals and bazar items with date, meal count, item name, and cost.
// Make the page responsive, modern, and visually appealing with Tailwind CSS.
// Include a welcome message with the user's name from Supabase authentication.

import { useMemo, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { fetchGlobalAggregates } from '../lib/aggregates';
import { formatDateWithDay } from '../lib/formatters';


const MealIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M4 3h2v8a2 2 0 1 1-4 0V3h2zm6 0h2v8a2 2 0 1 1-4 0V3h2zm8 0h2v8a2 2 0 1 1-4 0V3h2zM3 19a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1z"/>
  </svg>
);
const DepositIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 3l7 4v10l-7 4-7-4V7l7-4zm0 2.3L7 7.7v8.6l5 2.9 5-2.9V7.7l-5-2.4z"/>
  </svg>
);
const BalanceIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 1l9 4-9 4-9-4 9-4zm-7 7l7 3 7-3v6a7 7 0 1 1-14 0V8z"/>
  </svg>
);

export default function Dashboard() {
  const { user, member } = useAuth();
  const [meals, setMeals] = useState([]);
  const [bazar, setBazar] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [allTimeStats, setAllTimeStats] = useState({ myMeals: 0, myDeposits: 0, totalMealsAll: 0, totalBazarAll: 0 });
  const [poolStats, setPoolStats] = useState({ totalDepositsAll: 0, totalBazarAll: 0 });
  // no per-account data visibility warning

  useEffect(() => {
    let active = true;
    (async () => {
      if (!member) return;
      const [mealsRes, bazarRes, depositsRes] = await Promise.all([
        supabase.from('meals').select('*').eq('member_id', member.id),
        supabase.from('bazar').select('*').eq('member_id', member.id),
        supabase.from('deposits').select('*').eq('member_id', member.id),
      ]);
      if (!active) return;
      setMeals(mealsRes.data || []);
      setBazar(bazarRes.data || []);
      setDeposits(depositsRes.data || []);
    })();
    return () => { active = false; };
  }, [member]);

  // All-time stats for fair share/net balance
  useEffect(() => {
    let active = true;
    (async () => {
      if (!member) return;
      const [myMealsRes, myDepRes, globalAgg] = await Promise.all([
        supabase.from('meals').select('meal_count').eq('member_id', member.id),
        supabase.from('deposits').select('amount').eq('member_id', member.id),
        fetchGlobalAggregates(supabase),
      ]);
      if (!active) return;
      const myMeals = (myMealsRes.data || []).reduce((s, r) => s + (Number(r.meal_count) || 0), 0);
      const myDeposits = (myDepRes.data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  setAllTimeStats({ myMeals, myDeposits, totalMealsAll: globalAgg.totalMealsAll, totalBazarAll: globalAgg.totalBazarAll });
    })();
    return () => { active = false; };
  }, [member]);

  // Pool remaining cash: all members deposits - all bazar (all-time)
  useEffect(() => {
    let active = true;
    (async () => {
      const globalAgg = await fetchGlobalAggregates(supabase);
      if (!active) return;
      setPoolStats({ totalDepositsAll: globalAgg.totalDepositsAll, totalBazarAll: globalAgg.totalBazarAll });
    })();
    return () => { active = false; };
  }, []);

  const totalMeals = useMemo(() => meals.reduce((sum, m) => sum + (Number(m.meal_count) || 0), 0), [meals]);
  const totalBazar = useMemo(() => bazar.reduce((sum, b) => sum + (Number(b.cost) || 0), 0), [bazar]);
  const totalDeposits = useMemo(() => deposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0), [deposits]);
  // All-time net balance (Deposits - Meals * MealRate), where MealRate = totalBazarAll / totalMealsAll
  const mealRate = useMemo(() => {
    // Prefer global totals if available
    if (allTimeStats.totalMealsAll > 0) {
      return allTimeStats.totalBazarAll / allTimeStats.totalMealsAll;
    }
    // Fallback to locally visible data (usually your own rows if RLS limits reads)
    const myMealsOnly = totalMeals;
    const myBazarOnly = totalBazar;
    return myMealsOnly > 0 ? myBazarOnly / myMealsOnly : 0;
  }, [allTimeStats.totalMealsAll, allTimeStats.totalBazarAll, totalMeals, totalBazar]);
  const netBalance = useMemo(() => allTimeStats.myDeposits - (allTimeStats.myMeals * mealRate), [allTimeStats, mealRate]);
  const poolRemaining = useMemo(() => {
    // Prefer global pool if available (any non-zero or non-null indicates we fetched)
    const hasGlobal = Number.isFinite(poolStats.totalDepositsAll) || Number.isFinite(poolStats.totalBazarAll);
    const globalVal = (poolStats.totalDepositsAll || 0) - (poolStats.totalBazarAll || 0);
    if (hasGlobal && (poolStats.totalDepositsAll !== 0 || poolStats.totalBazarAll !== 0)) return globalVal;
    // Fallback to locally visible deposits minus bazar
    return totalDeposits - totalBazar;
  }, [poolStats, totalDeposits, totalBazar]);

  // remove visibility warning logic

  function StatCard({ title, value, Icon, color }) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-900 p-5 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
          </div>
          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${color} text-white`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </div>
    );
  }

  const recent = useMemo(() => {
    const items = [];
      for (const m of meals) {
        items.push({
          date: m.date,
        mealCount: m.meal_count,
        item: '-',
        cost: '-',
      });
    }
    for (const b of bazar) {
        items.push({
          date: b.date,
        mealCount: '-',
        item: b.item_name ?? b.item ?? b.name ?? '—',
        cost: Number(b.cost) || 0,
      });
    }
    return items
      .filter(r => r.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }, [meals, bazar]);

  const displayName = member?.name || user?.email || 'Guest';

  return (
    <div className="space-y-6">
      {/* Welcome */}
         <div className="flex flex-col gap-1">
           <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Welcome back, {displayName} 👋</h1>
           <p className="text-sm text-gray-600 dark:text-gray-400">Here’s a quick overview of your meal management.</p>
         </div>

  {/* Removed data visibility warning */}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard title="Total Meals" value={totalMeals} Icon={MealIcon} color="bg-blue-600" />
        <StatCard title="Total Deposits" value={`${totalDeposits.toFixed(2)} taka`} Icon={DepositIcon} color="bg-indigo-600" />
        <StatCard title="Meal Rate" value={allTimeStats.totalMealsAll ? `${mealRate.toFixed(2)} taka` : '—'} Icon={MealIcon} color="bg-cyan-600" />
  <StatCard title="Your Remaining Balance" value={`${netBalance >= 0 ? '' : '-'}${Math.abs(netBalance).toFixed(2)} taka`} Icon={BalanceIcon} color="bg-amber-600" />
        <StatCard title="Meal Box Remaining Cash" value={`${poolRemaining >= 0 ? '' : '-'}${Math.abs(poolRemaining).toFixed(2)} taka`} Icon={BalanceIcon} color="bg-teal-600" />
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Date','Meal Count','Item','Cost'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDateWithDay(row.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{row.mealCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{row.item}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{typeof row.cost === 'number' ? `${row.cost.toFixed(2)} taka` : row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
