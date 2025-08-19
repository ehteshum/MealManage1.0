import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const [stage, setStage] = useState('request'); // 'request' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    // If arriving from the magic link, Supabase sets a recovery session
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setStage('reset');
    })();
  }, []);

  const sendReset = async () => {
    setErr(''); setMsg('');
    if (!email) return setErr('Enter your email');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setMsg('Password reset email sent. Check your inbox (and spam).');
  };

  const applyReset = async () => {
    setErr(''); setMsg('');
    if (!password || password.length < 6) return setErr('Password must be at least 6 characters.');
    if (password !== confirm) return setErr('Passwords do not match.');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setErr(error.message);
    else setMsg('Password updated. You can close this page and sign in.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reset Password</h1>
        {err && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</div>}
        {msg && <div className="mt-3 text-sm text-green-600 dark:text-green-400">{msg}</div>}
        {stage === 'request' ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
              />
            </div>
            <button onClick={sendReset} disabled={loading}
              className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Sending…' : 'Send reset email'}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">New password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300">Confirm new password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirm}
                onChange={(e)=>setConfirm(e.target.value)}
              />
            </div>
            <button onClick={applyReset} disabled={loading}
              className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
