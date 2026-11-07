import { NavLink, Route, Routes } from 'react-router';
import { OfflineBadge } from './components/OfflineBadge';
import { Backup } from './pages/Backup';
import { CardGuide } from './pages/CardGuide';
import { Courses } from './pages/Courses';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import { RoundDetail } from './pages/RoundDetail';
import { RoundEntry } from './pages/RoundEntry';
import { Rounds } from './pages/Rounds';

export function App() {
  return (
    <div className="layout">
      <header className="topbar no-print">
        <NavLink to="/" className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={24} height={24} />
          Strokes Gained
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/rounds" end>
            Rounds
          </NavLink>
          <NavLink to="/rounds/new">Enter round</NavLink>
          <NavLink to="/courses">Courses</NavLink>
          <NavLink to="/guide">Card guide</NavLink>
          <NavLink to="/backup">Backup</NavLink>
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
          <Route path="/courses" element={<Courses />} />
          <Route path="/guide" element={<CardGuide />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
