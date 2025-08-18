import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDateWithDay } from '../lib/formatters';
import { supabase } from '../lib/supabaseClient';

export default function MemberReport() {
  const { id } = useParams();
  const memberId = id; // keep as string UUID
  const [member, setMember] = useState(null);
  const [meals, setMeals] = useState([]);
  const [bazar, setBazar] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [allMeals, setAllMeals] = useState([]);
  const [allBazar, setAllBazar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      if (!memberId) { setError('Invalid member id.'); setLoading(false); return; }
      const [mRes, myMealsRes, myBazarRes, myDepRes, allMealsRes, allBazarRes] = await Promise.all([
  supabase.from('members').select('id, name, email, phone').eq('id', memberId).single(),
        supabase.from('meals').select('id, meal_count, date').eq('member_id', memberId).order('date', { ascending: false }),
        supabase.from('bazar').select('id, item_name, cost, date, paid_from').eq('member_id', memberId).order('date', { ascending: false }),
        supabase.from('deposits').select('id, amount, date').eq('member_id', memberId).order('date', { ascending: false }),
        supabase.from('meals').select('meal_count'),
        supabase.from('bazar').select('cost'),
      ]);

      if (!active) return;
      if (mRes.error) { setError(mRes.error.message); setLoading(false); return; }
      setMember(mRes.data);
      if (myMealsRes.error) { setError(myMealsRes.error.message); setLoading(false); return; }
      if (myBazarRes.error && myBazarRes.error.code !== '42703') { setError(myBazarRes.error.message); setLoading(false); return; }
      if (myDepRes.error) { setError(myDepRes.error.message); setLoading(false); return; }
      if (allMealsRes.error) { setError(allMealsRes.error.message); setLoading(false); return; }
      if (allBazarRes.error) { setError(allBazarRes.error.message); setLoading(false); return; }
      setMeals(myMealsRes.data || []);
      setBazar(myBazarRes.data || []);
      setDeposits(myDepRes.data || []);
      setAllMeals(allMealsRes.data || []);
      setAllBazar(allBazarRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [memberId]);

  const stats = useMemo(() => {
    const totalMealsAll = (allMeals || []).reduce((s, r) => s + (Number(r.meal_count) || 0), 0);
    const totalBazarAll = (allBazar || []).reduce((s, r) => s + (Number(r.cost) || 0), 0);
    const mealRate = totalMealsAll > 0 ? totalBazarAll / totalMealsAll : 0;

    const myMeals = (meals || []).reduce((s, r) => s + (Number(r.meal_count) || 0), 0);
    const myDeposits = (deposits || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const myFairShare = myMeals * mealRate;
    const myNet = myDeposits - myFairShare;

    return { mealRate, myMeals, myDeposits, myFairShare, myNet };
  }, [allMeals, allBazar, meals, deposits]);

  if (loading) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>;
  }
  if (error) {
    return <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">{error}</div>;
  }
  if (!member) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Member not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-300">
            {(member.name || member.email || '?').slice(0,1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{member.name || 'Unnamed Member'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}{member.phone ? ` · ${member.phone}` : ''}</p>
          </div>
        </div>
        <Link to="/members" className="text-sm text-blue-600 hover:underline">Back to Members</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Meal Rate (all-time)" value={`${stats.mealRate.toFixed(2)} taka`} />
        <StatCard label="My Meals (all-time)" value={stats.myMeals} />
        <StatCard label="My Deposits (all-time)" value={`${stats.myDeposits.toFixed(2)} taka`} />
  <StatCard label="Remaining Balance" value={`${stats.myNet.toFixed(2)} taka`} highlight={true} />
      </div>

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <Panel title="My Bazar">
          <SimpleTable
            columns={[
              { h:'Date', render:(r)=> formatDateWithDay(r.date) },
              { k:'item_name', h:'Item', render:(r)=> r.item_name ?? r.item ?? r.name ?? '—' },
              { k:'cost', h:'Cost (taka)', render:(r)=> (Number(r.cost||0)).toFixed(2) },
              { k:'paid_from', h:'Paid From' },
            ]}
            rows={bazar}
            empty="No bazar yet."
          />
        </Panel>
  <Panel title="My Meals">
          <SimpleTable
            columns={[
              { h:'Date', render:(r)=> formatDateWithDay(r.date) },
              { k:'meal_count', h:'Meals' },
            ]}
            rows={meals}
            empty="No meals yet."
          />
        </Panel>
  <Panel title="My Deposits">
          <SimpleTable
            columns={[
              { h:'Date', render:(r)=> formatDateWithDay(r.date) },
              { k:'amount', h:'Amount (taka)', render:(r)=> (Number(r.amount||0)).toFixed(2) },
            ]}
            rows={deposits}
            empty="No deposits yet."
          />
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm ${highlight ? 'ring-1 ring-blue-100' : ''}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
  <div className="p-4 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

function SimpleTable({ columns, rows, empty, format }) {
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">{empty}</div>;
  }
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr>
          {columns.map((c, idx) => (
            <th key={c.k || idx} className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">{c.h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
            {columns.map((c, idx) => {
              const v = c.render ? c.render(r) : (c.k ? r[c.k] : undefined);
              const text = format ? format(c.k, v) : v;
              return <td key={c.k || idx} className="py-2 pr-4 text-gray-900 dark:text-gray-100">{String(text ?? '')}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
