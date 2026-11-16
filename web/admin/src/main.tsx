import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Loading } from './components/StateView';
import { AcademyPage } from './pages/AcademyPage';
import { Announcements } from './pages/Announcements';
import { CustomerPage } from './pages/CustomerPage';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Finance } from './pages/Finance';
import { Plans } from './pages/Plans';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Support } from './pages/Support';
import { TicketPage } from './pages/TicketPage';
import { Academies } from './pages/Academies';
import { Login } from './pages/Login';
import { NoAccess } from './pages/NoAccess';
import { UserPage } from './pages/UserPage';
import { Users } from './pages/Users';
import { SessionProvider, useSession } from './session';
import './tokens.css';
import './style.css';

function App() {
  const session = useSession();
  switch (session.kind) {
    case 'loading':
      return (
        <div className="center-page">
          <Loading />
        </div>
      );
    case 'signedOut':
      return <Login />;
    case 'notAdmin':
      return <NoAccess email={session.session.user.email} />;
    case 'error':
      return <NoAccess email={session.session.user.email} error={session.error} />;
    case 'admin':
      // Hash routes: the static host needs no rewrite rules.
      return (
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="clientes" element={<Customers />} />
              <Route path="clientes/:id" element={<CustomerPage />} />
              <Route path="financeiro" element={<Finance />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="suporte" element={<Support />} />
              <Route path="suporte/:id" element={<TicketPage />} />
              <Route path="academias" element={<Academies />} />
              <Route path="academias/:id" element={<AcademyPage />} />
              <Route path="planos" element={<Plans />} />
              <Route path="avisos" element={<Announcements />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="usuarios" element={<Users />} />
              <Route path="usuarios/:id" element={<UserPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
