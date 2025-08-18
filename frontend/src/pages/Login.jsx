import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    setLoading(false);
    if (error) return setError(error.message);
    navigate('/');
  };

  const resendVerification = async () => {
    setError('');
    setInfo('');
    const email = form.email.trim();
    if (!email) {
      setError('Enter your email above, then click Resend.');
      return;
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) setError(error.message);
    else setInfo('Verification email resent. Check your inbox (and spam).');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Login</h1>
        {error && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
            {String(error).toLowerCase().includes('confirm') && (
              <button type="button" onClick={resendVerification}
                className="ml-2 inline-flex items-center text-blue-600 hover:underline">
                Resend verification
              </button>
            )}
          </div>
        )}
  {info && <div className="mt-3 text-sm text-green-600 dark:text-green-400">{info}</div>}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300">Email</label>
            <input name="email" type="email" required value={form.email} onChange={onChange}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300">Password</label>
            <input name="password" type="password" required value={form.password} onChange={onChange}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">No account? <Link className="text-blue-600 hover:underline" to="/signup">Create one</Link></p>
      </div>
    </div>
  );
}
