import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying your email...');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        setErr(error.message);
        setStatus('Verification failed');
      } else {
        setStatus('Email verified! Redirecting...');
        setTimeout(() => navigate('/'), 800);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{status}</h1>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}
