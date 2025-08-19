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
  const [meals, setMeals] = useState([]); // meals in a window up to lunchDate
  const [error, setError] = useState('');

  const fetchData = async (dd, ld) => {
    setError('');
    try {
      const memReq = supabase.from('members').select('*');
      // Fetch a rolling window of recent meals so we can carry-forward values when missing
      const windowDays = 30;
      const start = (() => {
        try {
          const [y, m, d] = (dd || todayISOInTZ()).split('-').map(Number);
          const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
          dt.setUTCDate(dt.getUTCDate() - windowDays);
          return dt.toISOString().slice(0, 10);
        } catch {
          return dd;
        }
      })();
      const mealsReq = supabase
        .from('meals')
        .select('id, member_id, meal_count, date, created_at')
        .gte('date', start)
        .lte('date', ld);
      const [memRes, mealsRes] = await Promise.all([memReq, mealsReq]);
      if (memRes.error) throw memRes.error;
      if (mealsRes.error) {
        // If created_at column doesn't exist, retry without it
        if ((mealsRes.error.message || '').toLowerCase().includes('created_at')) {
          const mealsRes2 = await supabase
            .from('meals')
            .select('id, member_id, meal_count, date')
            .gte('date', start)
            .lte('date', ld);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        // Any change in "meals" could affect carry-forward; refetch window
        fetchData(dinnerDate, lunchDate);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dinnerDate, lunchDate]);

  // Modal UI state for nice selection and inputs
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'edit' | 'delete'
  const [modalRow, setModalRow] = useState(null);
  const [chooseDinner, setChooseDinner] = useState(false);
  const [chooseLunch, setChooseLunch] = useState(false);
  const [editDinnerValue, setEditDinnerValue] = useState('');
  const [editLunchValue, setEditLunchValue] = useState('');
  const [modalError, setModalError] = useState('');

  const openEditModal = (r) => {
    setModalType('edit');
    setModalRow(r);
    setChooseDinner(Boolean(r.dinnerRecId));
    setChooseLunch(Boolean(r.lunchRecId));
    setEditDinnerValue(r.dinner ?? 0);
    setEditLunchValue(r.lunch ?? 0);
    setModalError('');
    setModalOpen(true);
  };
  const openDeleteModal = (r) => {
    setModalType('delete');
    setModalRow(r);
    setChooseDinner(Boolean(r.dinnerRecId));
    setChooseLunch(Boolean(r.lunchRecId));
    setModalError('');
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setModalRow(null);
    setModalError('');
  };
  const submitModal = async () => {
    if (!modalRow) return;
    setModalError('');
    try {
      if (modalType === 'edit') {
        const ops = [];
        if (chooseDinner && modalRow.dinnerRecId) {
          const val = Number(editDinnerValue);
          if (Number.isNaN(val)) throw new Error('Dinner value must be a number');
          ops.push(supabase.from('meals').update({ meal_count: val }).eq('id', modalRow.dinnerRecId));
        }
        if (chooseLunch && modalRow.lunchRecId) {
          const val = Number(editLunchValue);
          if (Number.isNaN(val)) throw new Error('Lunch value must be a number');
          ops.push(supabase.from('meals').update({ meal_count: val }).eq('id', modalRow.lunchRecId));
        }
        if (ops.length === 0) throw new Error('Select at least one target');
        const results = await Promise.all(ops);
        const err = results.find(r => r.error)?.error;
        if (err) throw err;
      } else if (modalType === 'delete') {
        const ops = [];
        if (chooseDinner && modalRow.dinnerRecId) ops.push(supabase.from('meals').delete().eq('id', modalRow.dinnerRecId));
        if (chooseLunch && modalRow.lunchRecId) ops.push(supabase.from('meals').delete().eq('id', modalRow.lunchRecId));
        if (ops.length === 0) throw new Error('Select at least one target');
        const results = await Promise.all(ops);
        const err = results.find(r => r.error)?.error;
        if (err) throw err;
      }
      closeModal();
      await fetchData(dinnerDate, lunchDate);
    } catch (e) {
      setModalError(e.message || 'Operation failed');
    }
  };

  const rows = useMemo(() => {
    const nameById = new Map();
    for (const m of members) nameById.set(m.id, m.name || m.email || 'Unnamed');

    // Build per-member records sorted by date then created_at
    const byMember = new Map();
    for (const r of meals) {
      const list = byMember.get(r.member_id) || [];
      list.push(r);
      byMember.set(r.member_id, list);
    }
  for (const list of byMember.values()) {
      list.sort((a, b) => {
        const da = (a.date || '').slice(0,10);
        const db = (b.date || '').slice(0,10);
        if (da === db) {
          const ta = a.created_at || '';
          const tb = b.created_at || '';
          return ta.localeCompare(tb);
        }
        return da.localeCompare(db);
      });
    }

    function latestOnOrBefore(memberId, targetDate) {
      const list = byMember.get(memberId) || [];
      // Find latest record with date <= targetDate; since sorted asc, iterate backwards
      for (let i = list.length - 1; i >= 0; i--) {
        const rec = list[i];
        const d = (rec.date || '').slice(0, 10);
        if (d <= targetDate) return rec;
      }
      return null;
    }

    function isLateSubmission(rec) {
      if (!rec || !rec.created_at) return false;
      return isAfterHourInTZ(rec.created_at, 18, 'Asia/Dhaka');
    }

    const result = [];
    for (const m of members) {
      const dinnerRec = latestOnOrBefore(m.id, dinnerDate);
      const lunchRec = latestOnOrBefore(m.id, lunchDate);
      const dinnerVal = dinnerRec ? (Number(dinnerRec.meal_count) || 0) : 0;
      const lunchVal = lunchRec ? (Number(lunchRec.meal_count) || 0) : 0;
      const dinnerLate = isLateSubmission(dinnerRec);
      const lunchLate = isLateSubmission(lunchRec);
      result.push({
        memberId: m.id,
        name: nameById.get(m.id),
        dinner: dinnerVal,
        lunch: lunchVal,
        dinnerTime: dinnerLate && dinnerRec ? dinnerRec.created_at : null,
        lunchTime: lunchLate && lunchRec ? lunchRec.created_at : null,
        dinnerLate,
        lunchLate,
        dinnerRecId: dinnerRec?.id || null,
        lunchRecId: lunchRec?.id || null,
        dinnerRecDate: dinnerRec?.date?.slice(0,10) || null,
        lunchRecDate: lunchRec?.date?.slice(0,10) || null,
      });
    }

    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [members, meals, dinnerDate, lunchDate]);

  const totals = useMemo(() => {
    let dinner = 0, lunch = 0;
    for (const r of rows) { dinner += r.dinner; lunch += r.lunch; }
    const all = dinner + lunch;
    return { dinner, lunch, all };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-1">Dinner date</label>
          <input
            type="date"
            value={dinnerDate}
            onChange={(e) => setDinnerDate(e.target.value)}
            className="border p-2 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-1">Lunch date (auto)</label>
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
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Meal Chart</h2>
        </div>
  <div className="overflow-x-auto">
          <table className="min-w-[600px] divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Name','Dinner','Lunch','Actions'].map((h) => (
                  <th key={h} className="px-3 sm:px-4 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900">{r.name}</td>
                  <td className={`px-3 sm:px-4 py-3 text-xs sm:text-sm ${r.dinnerLate ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.dinner || 0}</span>
                    </div>
                    {r.dinnerLate && r.dinnerTime && (
                      <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">{formatTimeInTZ(r.dinnerTime, 'Asia/Dhaka')}</div>
                    )}
                    {r.dinnerRecDate && (
                      <div className="text-[10px] text-gray-400">from {r.dinnerRecDate}</div>
                    )}
                  </td>
                  <td className={`px-3 sm:px-4 py-3 text-xs sm:text-sm ${r.lunchLate ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.lunch || 0}</span>
                    </div>
                    {r.lunchLate && r.lunchTime && (
                      <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">{formatTimeInTZ(r.lunchTime, 'Asia/Dhaka')}</div>
                    )}
                    {r.lunchRecDate && (
                      <div className="text-[10px] text-gray-400">from {r.lunchRecDate}</div>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-right">
                    <div className="flex items-center justify-end gap-2 sm:gap-3">
                      <button
                        className="text-[11px] sm:text-xs text-blue-600 hover:underline"
                        onClick={() => openEditModal(r)}
                      >Edit</button>
                      <button
                        className="text-[11px] sm:text-xs text-red-600 hover:underline"
                        onClick={() => openDeleteModal(r)}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Total</td>
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">{totals.dinner}</td>
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">{totals.lunch}</td>
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">&nbsp;</td>
              </tr>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Total (Dinner + Lunch)</td>
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">—</td>
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">{totals.all}</td>
                <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">&nbsp;</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black/5 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">{modalType} meal{modalType==='delete'?' (confirm)':''}</h3>
                {modalRow && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Member: {modalRow.name}</p>
                )}
              </div>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close" onClick={closeModal}>✕</button>
            </div>

            {/* Body */}
            <div className="mt-4 space-y-5">
              {/* Target selector pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Select target:</span>
                <button
                  type="button"
                  disabled={!modalRow?.dinnerRecId}
                  onClick={() => setChooseDinner(v => !v)}
                  className={`rounded-full px-3 py-1 text-sm border ${chooseDinner ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'} disabled:opacity-50`}
                >
                  Dinner{modalRow?.dinnerRecDate ? ` • ${modalRow.dinnerRecDate}` : ''}
                </button>
                <button
                  type="button"
                  disabled={!modalRow?.lunchRecId}
                  onClick={() => setChooseLunch(v => !v)}
                  className={`rounded-full px-3 py-1 text-sm border ${chooseLunch ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'} disabled:opacity-50`}
                >
                  Lunch{modalRow?.lunchRecDate ? ` • ${modalRow.lunchRecDate}` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => { if (modalRow?.dinnerRecId) setChooseDinner(true); if (modalRow?.lunchRecId) setChooseLunch(true); }}
                  className="rounded-full px-3 py-1 text-sm border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                >Both</button>
                <button
                  type="button"
                  onClick={() => { setChooseDinner(false); setChooseLunch(false); }}
                  className="rounded-full px-3 py-1 text-sm border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                >Clear</button>
              </div>

              {modalType === 'edit' && (
                <div className="space-y-4">
                  {/* Dinner input row */}
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-sm text-gray-700 dark:text-gray-300">Dinner</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        disabled={!chooseDinner || !modalRow?.dinnerRecId}
                        onClick={() => setEditDinnerValue(v => String(Math.max(0, Number(v || 0) - 0.5)))}
                        aria-label="Decrease dinner"
                      >−</button>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
                        value={editDinnerValue}
                        onChange={(e) => setEditDinnerValue(e.target.value)}
                        disabled={!chooseDinner || !modalRow?.dinnerRecId}
                      />
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        disabled={!chooseDinner || !modalRow?.dinnerRecId}
                        onClick={() => setEditDinnerValue(v => String(Number(v || 0) + 0.5))}
                        aria-label="Increase dinner"
                      >+</button>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      {[0,0.5,1,1.5,2].map(p => (
                        <button key={`d-${p}`}
                          type="button"
                          className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                          disabled={!chooseDinner || !modalRow?.dinnerRecId}
                          onClick={() => setEditDinnerValue(String(p))}
                        >{p}</button>
                      ))}
                    </div>
                  </div>
                  {/* Lunch input row */}
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-sm text-gray-700 dark:text-gray-300">Lunch</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        disabled={!chooseLunch || !modalRow?.lunchRecId}
                        onClick={() => setEditLunchValue(v => String(Math.max(0, Number(v || 0) - 0.5)))}
                        aria-label="Decrease lunch"
                      >−</button>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
                        value={editLunchValue}
                        onChange={(e) => setEditLunchValue(e.target.value)}
                        disabled={!chooseLunch || !modalRow?.lunchRecId}
                      />
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        disabled={!chooseLunch || !modalRow?.lunchRecId}
                        onClick={() => setEditLunchValue(v => String(Number(v || 0) + 0.5))}
                        aria-label="Increase lunch"
                      >+</button>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      {[0,0.5,1,1.5,2].map(p => (
                        <button key={`l-${p}`}
                          type="button"
                          className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                          disabled={!chooseLunch || !modalRow?.lunchRecId}
                          onClick={() => setEditLunchValue(String(p))}
                        >{p}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'delete' && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                  Deleting will permanently remove the selected meal records. This action cannot be undone.
                </div>
              )}

              {modalError && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-2 text-sm text-red-700 dark:text-red-300">{modalError}</div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                onClick={closeModal}
              >Cancel</button>
              <button
                className={`rounded-md px-3 py-1.5 text-sm text-white ${modalType==='delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={submitModal}
              >{modalType==='delete' ? 'Delete' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
