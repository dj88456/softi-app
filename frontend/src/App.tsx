import { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { CurrentUser } from './types';
import Layout from './components/Layout';
import Home from './pages/Home';
import MemberReport from './pages/MemberReport';
import TeamConsolidation from './pages/TeamConsolidation';
import ConsolidationDrafts from './pages/ConsolidationDrafts';
import SecretaryDashboard from './pages/SecretaryDashboard';
import Admin from './pages/Admin';
import PublicDashboard from './pages/PublicDashboard';

// ─── User Context ──────────────────────────────────────────────────────────────

interface UserCtx {
  user: CurrentUser | null;
  setUser: (u: CurrentUser | null) => void;
}

const UserContext = createContext<UserCtx>({ user: null, setUser: () => {} });

export function useUser() {
  return useContext(UserContext);
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUserState] = useState<CurrentUser | null>(() => {
    try {
      const saved = localStorage.getItem('bts_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const setUser = (u: CurrentUser | null) => {
    setUserState(u);
    if (u) localStorage.setItem('bts_user', JSON.stringify(u));
    else localStorage.removeItem('bts_user');
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/report" element={
              user?.role === 'member' || user?.role === 'leader'
                ? <MemberReport />
                : <Navigate to="/" replace />
            } />
            <Route path="/consolidation" element={
              user?.role === 'leader'
                ? <TeamConsolidation />
                : <Navigate to="/" replace />
            } />
            <Route path="/drafts" element={
              user?.role === 'leader'
                ? <ConsolidationDrafts />
                : <Navigate to="/" replace />
            } />
            <Route path="/dashboard" element={
              user?.role === 'secretary'
                ? <SecretaryDashboard />
                : <Navigate to="/" replace />
            } />
            <Route path="/admin" element={
              user?.role === 'admin'
                ? <Admin />
                : <Navigate to="/" replace />
            } />
            <Route path="/view" element={<PublicDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </UserContext.Provider>
  );
}
