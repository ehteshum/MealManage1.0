import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      setLoading(true);
  const { data, error } = await supabase.from('members').select('id, name, email, phone');
      if (!active) return;
      if (error) {
        setError(error.message);
        setMembers([]);
      } else {
        setMembers((data || []).sort((a,b) => (a.name||'').localeCompare(b.name||'')));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Members</h2>
        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{loading ? 'Loading…' : `${members.length} total`}</div>
      </div>
      {error && <div className="p-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20">{error}</div>}
      <ul>
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                {(m.name || m.email || '?').slice(0,1).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{m.name || 'Unnamed'}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{m.email}{m.phone ? ` · ${m.phone}` : ''}</div>
              </div>
            </div>
            <Link to={`/members/${m.id}`} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700">
              View Report
            </Link>
          </li>
        ))}
        {!loading && !error && members.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No members found.</li>
        )}
      </ul>
    </div>
  );
}
