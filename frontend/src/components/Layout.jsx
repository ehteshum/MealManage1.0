import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Button from './ui/Button';

// Dark mode toggle hidden; icons removed

export default function Layout() {
  const { user, member, signOut } = useAuth();
  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 hover:text-gray-900 ${
      isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
    }`;

  // Profile modal state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const name = member?.name || user?.user_metadata?.name || '';
    setDisplayName(name || user?.email || '');
  }, [member, user]);

  const openProfile = () => {
    setProfileMsg('');
    setProfileName(member?.name || user?.user_metadata?.name || '');
    setProfileEmail(user?.email || member?.email || '');
    setProfilePhone(member?.phone || '');
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setProfileMsg('');
    setSavingProfile(true);
    try {
      // Update members table (name, phone)
      if (member?.id) {
        let { error: upErr } = await supabase
          .from('members')
          .update({ name: profileName || null, phone: profilePhone || null })
          .eq('id', member.id);
        if (upErr && String(upErr.message || '').includes('column') && String(upErr.message || '').includes('phone')) {
          // Retry without phone if column missing
          const res2 = await supabase
            .from('members')
            .update({ name: profileName || null })
            .eq('id', member.id);
          upErr = res2.error;
          if (!upErr) {
            setProfileMsg("Phone field isn't available in your database yet. Saved name only.");
          }
        }
        if (upErr) throw upErr;
      }

      // Update auth user metadata name for immediate UI reflection
  const { error: authErr } = await supabase.auth.updateUser({ data: { name: profileName || null } });
      if (authErr) {
        // Not critical; continue but show message
        setProfileMsg(`Saved, but couldn't update sign-in profile name: ${authErr.message}`);
      }
      setDisplayName(profileName || user?.email || '');
      setProfileOpen(false);
    } catch (e) {
      setProfileMsg(e.message || 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">Meal Manage</span>
              <div className="hidden md:flex items-center gap-2">
                <NavLink to="/" end className={navLinkClass}>Dashboard</NavLink>
                <NavLink to="/meals" className={navLinkClass}>Meals</NavLink>
                <NavLink to="/bazar" className={navLinkClass}>Bazar</NavLink>
                <NavLink to="/deposits" className={navLinkClass}>Deposits</NavLink>
                <NavLink to="/members" className={navLinkClass}>Members</NavLink>
                <NavLink to="/reports" className={navLinkClass}>Reports</NavLink>
                <NavLink to="/meal-chart" className={navLinkClass}>Meal Chart</NavLink>
                {user && <NavLink to="/admin/cleanup" className={navLinkClass}>Admin</NavLink>}
                {!user && <NavLink to="/login" className={navLinkClass}>Login</NavLink>}
                {!user && <NavLink to="/signup" className={navLinkClass}>Signup</NavLink>}
              </div>
            </div>
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-3">
              {user && (
                <>
                  <button
                    onClick={openProfile}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm hover:shadow transition-shadow"
                    title="View profile"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
                      {(displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[12rem]">{displayName || user.email}</span>
                  </button>
                  <Button onClick={signOut} variant="secondary" size="md">Logout</Button>
                </>
              )}
            </div>
            {/* Mobile hamburger */}
            <div className="md:hidden flex items-center gap-2">
              <Button onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu" variant="outline" size="md">{mobileOpen ? 'Close' : 'Menu'}</Button>
            </div>
          </div>
        </div>
        {/* Mobile menu drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2">
              <NavLink to="/" end className={navLinkClass} onClick={() => setMobileOpen(false)}>Dashboard</NavLink>
              <NavLink to="/meals" className={navLinkClass} onClick={() => setMobileOpen(false)}>Meals</NavLink>
              <NavLink to="/bazar" className={navLinkClass} onClick={() => setMobileOpen(false)}>Bazar</NavLink>
              <NavLink to="/deposits" className={navLinkClass} onClick={() => setMobileOpen(false)}>Deposits</NavLink>
              <NavLink to="/members" className={navLinkClass} onClick={() => setMobileOpen(false)}>Members</NavLink>
              <NavLink to="/reports" className={navLinkClass} onClick={() => setMobileOpen(false)}>Reports</NavLink>
              <NavLink to="/meal-chart" className={navLinkClass} onClick={() => setMobileOpen(false)}>Meal Chart</NavLink>
              {user && <NavLink to="/admin/cleanup" className={navLinkClass} onClick={() => setMobileOpen(false)}>Admin</NavLink>}
              {!user && <NavLink to="/login" className={navLinkClass} onClick={() => setMobileOpen(false)}>Login</NavLink>}
              {!user && <NavLink to="/signup" className={navLinkClass} onClick={() => setMobileOpen(false)}>Signup</NavLink>}
              {user && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => { openProfile(); setMobileOpen(false); }}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm hover:shadow transition-shadow"
                    title="View profile"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
                      {(displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[10rem]">{displayName || user.email}</span>
                  </button>
                  <Button onClick={() => { setMobileOpen(false); signOut(); }} variant="secondary" size="md">Logout</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
  <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950">
        <Outlet />
      </main>

      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl ring-1 ring-gray-100 dark:ring-gray-800">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Profile</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300">Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e)=>setProfileName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={profileEmail}
                  readOnly
                  className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300">Phone</label>
                <input
                  type="tel"
                  placeholder="e.g. 01712-345678"
                  value={profilePhone}
                  onChange={(e)=>setProfilePhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100"
                />
              </div>
              {/* Theme selection removed as dark mode is disabled */}
              {profileMsg && (
                <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 px-3 py-2 rounded">
                  {profileMsg}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
              <Button onClick={()=> setProfileOpen(false)} disabled={savingProfile} variant="outline" size="md">Cancel</Button>
              <Button onClick={saveProfile} disabled={savingProfile} variant="primary" size="md">{savingProfile ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
