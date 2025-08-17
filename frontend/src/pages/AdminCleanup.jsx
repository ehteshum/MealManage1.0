import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function AdminCleanup() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ members: 0, meals: 0, bazar: 0, deposits: 0 });
  const [confirmText, setConfirmText] = useState('');
  const [memberName, setMemberName] = useState('');
  const [workingName, setWorkingName] = useState(false);
  const [workingNoAuth, setWorkingNoAuth] = useState(false);

  const refreshSummary = async () => {
    const [m1, m2, m3, m4] = await Promise.all([
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('meals').select('id', { count: 'exact', head: true }),
      supabase.from('bazar').select('id', { count: 'exact', head: true }),
      supabase.from('deposits').select('id', { count: 'exact', head: true }),
    ]);
    setSummary({
      members: m1.count || 0,
      meals: m2.count || 0,
      bazar: m3.count || 0,
      deposits: m4.count || 0,
    });
  };

  useEffect(() => {
    (async () => {
      await refreshSummary();
    })();
  }, []);

  const wipeOwnData = async () => {
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const { data: meRows, error: meErr } = await supabase
        .from('members')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (meErr) throw meErr;
      const meId = meRows?.id;
      if (!meId) throw new Error('Your member profile was not found.');

      const delMeals = supabase.from('meals').delete().eq('member_id', meId);
      const delBazar = supabase.from('bazar').delete().eq('member_id', meId);
      const delDeps = supabase.from('deposits').delete().eq('member_id', meId);
      const [dm, db, dd] = await Promise.all([delMeals, delBazar, delDeps]);
      if (dm.error) throw dm.error; if (db.error) throw db.error; if (dd.error) throw dd.error;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const wipeAllData = async () => {
    if (confirmText !== 'erase all') { setError('Type "erase all" to confirm.'); return; }
    setError('');
    setLoading(true);
    try {
      const [m1, m2, m3] = await Promise.all([
        supabase.from('meals').delete().neq('id', 0),
        supabase.from('bazar').delete().neq('id', 0),
        supabase.from('deposits').delete().neq('id', 0),
      ]);
      if (m1.error) throw m1.error; if (m2.error) throw m2.error; if (m3.error) throw m3.error;
      await refreshSummary();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteByMemberName = async () => {
    if (!memberName.trim()) { setError('Enter a member name.'); return; }
    setError('');
    setWorkingName(true);
    try {
      const { data: memRows, error: memErr } = await supabase
        .from('members')
        .select('id, name')
        .ilike('name', memberName.trim());
      if (memErr) throw memErr;
      const ids = (memRows || []).map(r => r.id);
      if (!ids.length) { setError('No members matched that name.'); return; }
      // cascade delete children first
      const [dm, db, dd] = await Promise.all([
        supabase.from('meals').delete().in('member_id', ids),
        supabase.from('bazar').delete().in('member_id', ids),
        supabase.from('deposits').delete().in('member_id', ids),
      ]);
      if (dm.error) throw dm.error; if (db.error) throw db.error; if (dd.error) throw dd.error;
      const delMembers = await supabase.from('members').delete().in('id', ids);
      if (delMembers.error) throw delMembers.error;
      setMemberName('');
      await refreshSummary();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkingName(false);
    }
  };

  const deleteMembersWithoutAuth = async () => {
    setError('');
    setWorkingNoAuth(true);
    try {
      const { data: memRows, error: memErr } = await supabase
        .from('members')
        .select('id')
        .is('auth_user_id', null);
      if (memErr) throw memErr;
      const ids = (memRows || []).map(r => r.id);
      if (!ids.length) { return; }
      const [dm, db, dd] = await Promise.all([
        supabase.from('meals').delete().in('member_id', ids),
        supabase.from('bazar').delete().in('member_id', ids),
        supabase.from('deposits').delete().in('member_id', ids),
      ]);
      if (dm.error) throw dm.error; if (db.error) throw db.error; if (dd.error) throw dd.error;
      const delMembers = await supabase.from('members').delete().in('id', ids);
      if (delMembers.error) throw delMembers.error;
      await refreshSummary();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkingNoAuth(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Admin – Data Cleanup</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Remove seeded/test data. Use with caution.</p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Members</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.members}</div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Meals</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.meals}</div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Bazar</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.bazar}</div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">Deposits</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.deposits}</div>
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wipe My Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Deletes your meals, bazar, and deposits. Keeps your member profile.</p>
        <button
          disabled={loading}
          onClick={wipeOwnData}
          className={`px-4 py-2 rounded bg-red-600 text-white ${loading ? 'opacity-60' : ''}`}
        >{loading ? 'Working…' : 'Delete My Records'}</button>
      </div>

      <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Member by Name</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Deletes the member and all their records (meals, bazar, deposits). Example: Default Member</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Member name (case-insensitive)"
            className="border p-2 rounded w-64 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          />
          <button
            disabled={workingName}
            onClick={deleteByMemberName}
            className={`px-4 py-2 rounded bg-amber-600 text-white ${workingName ? 'opacity-60' : ''}`}
          >{workingName ? 'Working…' : 'Delete by Name'}</button>
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Members Without Account</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Removes members where auth_user_id is NULL and all their records.</p>
        <button
          disabled={workingNoAuth}
          onClick={deleteMembersWithoutAuth}
          className={`px-4 py-2 rounded bg-gray-900 text-white ${workingNoAuth ? 'opacity-60' : ''}`}
        >{workingNoAuth ? 'Working…' : 'Delete No-Auth Members'}</button>
      </div>

      <div className="rounded-xl bg-white dark:bg-gray-900 p-4 ring-1 ring-gray-100 dark:ring-gray-800 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wipe ALL Records</h2>
        <p className="text-sm text-red-700">Danger zone. Requires elevated permissions; may be blocked by RLS in client apps.</p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type "erase all" to confirm'
          className="border p-2 rounded w-64 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
        />
        <div>
          <button
            disabled={loading}
            onClick={wipeAllData}
            className={`px-4 py-2 rounded bg-black text-white ${loading ? 'opacity-60' : ''}`}
          >{loading ? 'Working…' : 'Delete ALL (try)'}</button>
        </div>
      </div>
    </div>
  );
}
