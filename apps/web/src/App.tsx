import { NavLink, Route, Routes } from 'react-router';
import { useAccount } from './auth/context';
import { OfflineBadge } from './components/OfflineBadge';
import { Account } from './pages/Account';
import { Backup } from './pages/Backup';
import { CardGuide } from './pages/CardGuide';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import { RoundDetail } from './pages/RoundDetail';
import { RoundEntry } from './pages/RoundEntry';
import { Rounds } from './pages/Rounds';

export function App() {
  const { enabled, profile, status } = useAccount();
  return (
    <div className="layout">
      <header className="topbar no-print">
        <NavLink to="/" className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={24} height={24} />
          Strokes Gained
        </NavLink>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/rounds" end>
            Rounds
          </NavLink>
          <NavLink to="/rounds/new" className="nav-cta">
            New round
          </NavLink>
          <NavLink to="/guide">Card guide</NavLink>
          <NavLink to="/data">My data</NavLink>
          {enabled && (
            <NavLink
              to="/account"
              className={status.state === 'signin' ? 'nav-attention' : undefined}
            >
              {profile ? (profile.givenName ?? 'Account') : 'Sign in'}
            </NavLink>
          )}
        </nav>
        <OfflineBadge />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rounds" element={<Rounds />} />
          <Route path="/rounds/new" element={<RoundEntry />} />
          <Route path="/rounds/:id" element={<RoundDetail />} />
          <Route path="/rounds/:id/edit" element={<RoundEntry />} />
          <Route path="/guide" element={<CardGuide />} />
          <Route path="/data" element={<Backup />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
