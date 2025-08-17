import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
  const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    setLoading(false);
  if (error) return setError(error.message);
  setSuccess('Account created successfully');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create account</h1>
  {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
  {success && <div className="mt-3 text-sm text-green-600">{success}</div>}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300">Name</label>
            <input name="name" type="text" required value={form.name} onChange={onChange}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
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
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
  <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Already have an account? <Link className="text-blue-600 hover:underline" to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
