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
import { formatDateWithDay, formatTimeInTZ } from '../lib/formatters';

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

  function StatCard({ title, value, Icon, color, imgSrc, imgAlt = 'icon' }) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-900 p-5 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
          </div>
          {imgSrc ? (
            <img src={imgSrc} alt={imgAlt} className="w-12 h-12 object-contain" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/logo192.png'; }} />
          ) : (
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${color} text-white`}>
              <Icon className="h-6 w-6" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Removed recent activity aggregator; replaced by weekly plan and notice board.

  const displayName = member?.name || user?.email || 'Guest';

  // Weekly plan current-day highlight (client local time)
  const daysHeaders = ['DAY','SATURDAY','SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
  const todayHeader = useMemo(() => {
    const d = new Date().getDay(); // 0=Sun ... 6=Sat
    switch (d) {
      case 0: return 'SUNDAY';
      case 1: return 'MONDAY';
      case 2: return 'TUESDAY';
      case 3: return 'WEDNESDAY';
      case 4: return 'THURSDAY';
      case 5: return 'FRIDAY';
      case 6: return 'SATURDAY';
      default: return '';
    }
  }, []);
  // Compute directly to avoid hook dependency noise
  const highlightIndex = daysHeaders.indexOf(todayHeader);
  const tdBase = "px-3 py-2 text-sm text-gray-700 dark:text-gray-300";
  const thRowBase = "px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 text-left";
  const hiNameOnly = (idx) => (idx === highlightIndex ? ' bg-yellow-50 dark:bg-yellow-900/20 font-semibold ring-1 ring-yellow-200 dark:ring-yellow-800' : '');

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
  <StatCard title="Total Meals" value={totalMeals} imgSrc="/icons/fried-rice (1).png" imgAlt="Total meals" />
  <StatCard title="Total Deposits" value={`${totalDeposits.toFixed(2)} taka`} imgSrc="/icons/output-onlinepngtools.png" imgAlt="Total deposits" />
  <StatCard title="Meal Rate" value={allTimeStats.totalMealsAll ? `${mealRate.toFixed(2)} taka` : '—'} imgSrc="/icons/interest-rate (1).png" imgAlt="Meal rate" />
  <StatCard title="Your Remaining Balance" value={`${netBalance >= 0 ? '' : '-'}${Math.abs(netBalance).toFixed(2)} taka`} imgSrc="/icons/balancing-scale (1).png" imgAlt="Your remaining balance" />
  <StatCard title="Meal Box Remaining Cash" value={`${poolRemaining >= 0 ? '' : '-'}${Math.abs(poolRemaining).toFixed(2)} taka`} imgSrc="/icons/safe-box.png" imgAlt="Meal box safe" />
      </div>

      {/* Weekly Plan + Notice Board */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Weekly Plan Table */}
        <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 lg:col-span-2">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Weekly Plan</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {daysHeaders.map((h) => (
                    <th key={h} className={"px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <th className={thRowBase}>LUNCH</th>
                  <td className={tdBase}>FISH</td>
                  <td className={tdBase}>VEGETABLE + BHORTA</td>
                  <td className={tdBase}>CHICKEN</td>
                  <td className={tdBase}>FISH</td>
                  <td className={tdBase}>CHICKEN</td>
                  <td className={tdBase}>FISH</td>
                  <td className={tdBase}>CHICKEN</td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <th className={thRowBase}>DINNER</th>
                  <td className={tdBase}>EGG + BHORTA</td>
                  <td className={tdBase}>CHICKEN</td>
                  <td className={tdBase}>FISH</td>
                  <td className={tdBase}>CHICKEN</td>
                  <td className={tdBase}>FISH + VEGETABLE</td>
                  <td className={tdBase}>CHICKEN</td>
                  <td className={tdBase}>FISH + VEGETABLE</td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <th className={thRowBase}>NAME</th>
                  <td className={`${tdBase}${hiNameOnly(1)}`}>MAMUN</td>
                  <td className={`${tdBase}${hiNameOnly(2)}`}>JEATH</td>
                  <td className={`${tdBase}${hiNameOnly(3)}`}>MAHARAJ</td>
                  <td className={`${tdBase}${hiNameOnly(4)}`}>ISHMAM</td>
                  <td className={`${tdBase}${hiNameOnly(5)}`}>SHOYEB</td>
                  <td className={`${tdBase}${hiNameOnly(6)}`}>KANIK</td>
                  <td className={`${tdBase}${hiNameOnly(7)}`}>MAHFUJ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Notice Board */}
        <div className="lg:col-span-1">
          <NoticeBoard postedBy={displayName} memberId={member?.id} />
        </div>
      </div>
    </div>
  );
}

// Simple notice board with local storage persistence
function NoticeBoard({ postedBy, memberId }) {
  const [noticeText, setNoticeText] = useState('');
  const [notices, setNotices] = useState([]);
  const [error, setError] = useState('');
  const [missingTable, setMissingTable] = useState(false);

  const fetchNotices = async () => {
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('notices')
        .select('id, text, created_at, name, member_id')
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) {
        if ((err.message || '').toLowerCase().includes('relation') || (err.message || '').toLowerCase().includes('not exist')) {
          setMissingTable(true);
          setNotices([]);
          return;
        }
        throw err;
      }
      setNotices(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load notices');
      setNotices([]);
    }
  };

  useEffect(() => {
    fetchNotices();
    const channel = supabase
      .channel('notices-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        fetchNotices();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNotice = async () => {
    const text = (noticeText || '').trim();
    if (!text) return;
    setError('');
    try {
      const payload = { text, name: postedBy || 'Unknown' };
      if (memberId) payload.member_id = memberId;
      const { error: err } = await supabase.from('notices').insert(payload);
      if (err) throw err;
      setNoticeText('');
      // fetchNotices will be triggered by realtime; also call once for immediate feedback
      fetchNotices();
    } catch (e) {
      setError(e.message || 'Failed to post notice');
    }
  };

  const clearAll = async () => {
    try {
      const { error: err } = await supabase.from('notices').delete().neq('id', 0);
      if (err) throw err;
      fetchNotices();
    } catch (e) {
      setError(e.message || 'Failed to clear notices');
    }
  };

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notice Board</h2>
        {notices.length > 0 && (
          <button onClick={clearAll} className="text-xs text-red-600 hover:underline">Clear all</button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {missingTable && (
          <div className="rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">
            Notice table not found. Create a table named "notices" with columns: id (uuid default gen_random_uuid or bigint), text (text), name (text), member_id, created_at (timestamptz default now()).
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}
        <div className="space-y-2">
          <textarea
            rows={3}
            value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)}
            placeholder="Write a notice..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
          />
          <div className="flex items-center justify-end">
            <button onClick={addNotice} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">Post Notice</button>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {notices.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No notices yet</div>
          )}
          {notices.map(n => {
            const created = n.created_at || n.date || '';
            const dayStr = created ? formatDateWithDay(created.slice(0, 10)) : '';
            const timeStr = created ? formatTimeInTZ(created, 'Asia/Dhaka') : '';
            return (
              <div key={n.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.name || 'Unknown'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{dayStr}{timeStr ? ` • ${timeStr}` : ''}</div>
                </div>
                <div className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{n.text}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
