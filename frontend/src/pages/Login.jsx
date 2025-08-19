import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
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

  const sendPasswordReset = async () => {
    setError(''); setInfo('');
    const email = (form.email || '').trim();
    if (!email) {
      setError('Enter your email above, then click Forgot password.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setInfo('Password reset email sent. Check your inbox (and spam).');
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
            <div className="mt-1 relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pr-10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showPassword ? (
                  // Eye-off icon
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l2.042 2.042C2.824 7.01 1.743 8.64 1.2 9.53a1.62 1.62 0 0 0 0 1.94C2.822 13.69 6.62 18 12 18c2.041 0 3.82-.58 5.318-1.44l3.152 3.152a.75.75 0 1 0 1.06-1.06L3.53 2.47ZM12 16.5c-4.74 0-8.027-3.67-9.45-5.53.541-.8 1.52-2.077 2.98-3.207l2.077 2.077A4.5 4.5 0 0 0 12 16.5Zm1.95-2.29-1.66-1.66a1.5 1.5 0 0 1-2.34-1.84l-1.24-1.24A3 3 0 0 0 12 15a2.98 2.98 0 0 0 1.95-.79ZM14.784 11.66l2.1 2.099A4.5 4.5 0 0 0 9.24 6.016l2.1 2.099A1.5 1.5 0 0 1 14.784 11.66Z"/>
                    <path d="M12 6c.85 0 1.665.144 2.426.406l1.293 1.293C14.79 7.242 13.44 7 12 7 7.26 7 3.973 10.67 2.55 12.53c.068.1.144.207.225.318l-1.18-1.18c.028-.039.058-.081.09-.126C3.178 9.31 6.976 5 12 5c1.103 0 2.14.176 3.11.5L14.73 5.12A6.98 6.98 0 0 0 12 6Z"/>
                  </svg>
                ) : (
                  // Eye icon
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M12 5c-5.024 0-8.822 4.31-10.315 6.542a1.62 1.62 0 0 0 0 1.916C3.178 15.69 6.976 20 12 20s8.822-4.31 10.315-6.542a1.62 1.62 0 0 0 0-1.916C20.822 9.31 17.024 5 12 5Zm0 12.5c-3.93 0-6.74-3.18-8.17-5.5 1.43-2.32 4.24-5.5 8.17-5.5s6.74 3.18 8.17 5.5c-1.43 2.32-4.24 5.5-8.17 5.5Zm0-9.5a4 4 0 1 0 .001 8.001A4 4 0 0 0 12 8.999Z"/>
                  </svg>
                )}
              </button>
            </div>
            <button type="button" onClick={sendPasswordReset} className="mt-2 text-sm text-blue-600 hover:underline">Forgot password?</button>
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
