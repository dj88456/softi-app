import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../App';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    setUser(null);
    navigate('/');
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav Bar */}
      <header className="bg-indigo-700 text-white shadow-md">
        <div className="w-full px-8 py-3.5 flex items-center justify-between">

          {/* Left: Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="font-black text-2xl tracking-tight">BTS</div>
            <div className="text-indigo-200 font-semibold hidden sm:block">SOFTI Weekly Report</div>
          </Link>

          {/* Center: Role-based nav */}
          <nav className="flex items-center gap-1">
            {user && (user.role === 'member' || user.role === 'leader') && (
              <NavLink to="/report" active={location.pathname === '/report'}>My Report</NavLink>
            )}
            {user?.role === 'leader' && (
              <NavLink to="/consolidation" active={location.pathname === '/consolidation'}>
                Team Consolidation
              </NavLink>
            )}
            {user?.role === 'secretary' && (
              <NavLink to="/dashboard" active={location.pathname === '/dashboard'}>
                Department Summary
              </NavLink>
            )}
            <NavLink to="/admin" active={location.pathname === '/admin'}>Admin</NavLink>
          </nav>

          {/* Right: User info */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user ? (
              <>
                <div className="text-right hidden sm:block">
                  <div className="font-bold text-sm">{user.member_name}</div>
                  <div className="text-indigo-300 text-xs font-medium capitalize">
                    {user.role}{user.team_name ? ` · ${user.team_name}` : ''}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
                >
                  Change User
                </button>
              </>
            ) : (
              <span className="text-indigo-300 text-sm font-medium">Not signed in</span>
            )}
          </div>

        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 w-full px-8 py-8">
        {children}
      </main>

      <footer className="text-center text-sm text-gray-400 font-medium py-4">
        BTS Department · SOFTI Weekly Report System
      </footer>
    </div>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-3.5 py-1.5 rounded-lg font-semibold text-sm transition ${
        active
          ? 'bg-white text-indigo-700'
          : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}
