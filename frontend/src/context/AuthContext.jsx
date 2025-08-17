import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({ user: null, session: null, member: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Fetch or create the member row tied to the auth user
  useEffect(() => {
    let mounted = true;
    (async () => {
      setMember(null);
      if (!user) return;
      // Try to find existing member by auth_user_id
      const { data: existing, error: fetchErr } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!mounted) return;
      if (fetchErr) {
        // leave member null; UI can handle missing member
        return;
      }
      if (existing) {
        setMember(existing);
        return;
      }
      // Create a member row if none exists
      const newMember = {
        id: crypto && crypto.randomUUID ? crypto.randomUUID() : undefined,
        auth_user_id: user.id,
        name: user.user_metadata?.name || user.email,
        email: user.email,
      };
      const { data: created, error: insertErr } = await supabase
        .from('members')
        .insert([newMember])
        .select()
        .maybeSingle();
      if (!mounted) return;
      if (!insertErr && created) setMember(created);
    })();
    return () => { mounted = false; };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, member, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
