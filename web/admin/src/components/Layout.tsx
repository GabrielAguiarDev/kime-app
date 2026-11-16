import {
  Barbell,
  ChartBar,
  Lifebuoy,
  List,
  Megaphone,
  SignOut,
  SquaresFour,
  Storefront,
  Tag,
  UsersThree,
  Wallet,
  X,
  type Icon,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router';
import { api } from '../api';
import { useSession } from '../session';
import { supabase } from '../supabase';

interface Item {
  to: string;
  label: string;
  icon: Icon;
  end?: boolean;
  /** Shows the count of tickets waiting for Kimi. */
  badge?: 'openTickets';
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Visão geral',
    items: [
      { to: '/', label: 'Dashboard', icon: SquaresFour, end: true },
      { to: '/relatorios', label: 'Relatórios', icon: ChartBar },
    ],
  },
  {
    title: 'Negócio',
    items: [
      { to: '/clientes', label: 'Clientes', icon: Storefront },
      { to: '/financeiro', label: 'Financeiro', icon: Wallet },
      { to: '/planos', label: 'Planos', icon: Tag },
    ],
  },
  {
    title: 'Operação',
    items: [
      { to: '/suporte', label: 'Suporte', icon: Lifebuoy, badge: 'openTickets' },
      { to: '/academias', label: 'Academias', icon: Barbell },
      { to: '/usuarios', label: 'Usuários', icon: UsersThree },
      { to: '/avisos', label: 'Avisos', icon: Megaphone },
    ],
  },
];

/** Shared with the pages (settings renames the admin; the sidebar follows). */
export interface AccountContext {
  name: string | null;
  setName: (name: string) => void;
}
export const useAccount = () => useOutletContext<AccountContext>();

/** The signed-in admin's name (own profile, readable by RLS); null until loaded or when blank. */
function useProfileName(userId: string | null) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => alive && setName(data?.full_name?.trim() || null));
    return () => {
      alive = false;
    };
  }, [userId]);
  return [name, setName] as const;
}

/**
 * Phone drawer: open/close, closes on navigation and Escape, locks the page
 * scroll while open and moves focus into the drawer and back to the toggle.
 */
function useDrawer() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('.nav-item')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const button = toggle.current;
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      button?.focus({ preventScroll: true });
    };
  }, [open]);

  return { open, setOpen, toggle, panel };
}

/** Tickets waiting for Kimi, refreshed on every navigation. */
function useOpenTickets() {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    api
      .listTickets('open', '')
      .then(rows => alive && setCount(rows.length))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);
  return count;
}

export function Layout() {
  const session = useSession();
  const user = session.kind === 'admin' ? session.session.user : null;
  const email = user?.email ?? '';
  const [name, setName] = useProfileName(user?.id ?? null);
  const displayName = name ?? email.split('@')[0];
  const openTickets = useOpenTickets();
  const drawer = useDrawer();

  return (
    <div className="shell">
      {/* Phones: top bar with the menu button; the sidebar becomes a drawer. */}
      <header className="mobilebar">
        <button
          ref={drawer.toggle}
          type="button"
          className="icon-btn"
          aria-label="Abrir menu"
          aria-expanded={drawer.open}
          aria-controls="sidebar"
          onClick={() => drawer.setOpen(true)}
        >
          <List size={20} weight="bold" aria-hidden="true" />
          {openTickets > 0 && <span className="dot" aria-hidden="true" />}
        </button>
        <div className="brand">
          <img src="/kimi.png" alt="" />
          <span className="brand-name">KIMI</span>
        </div>
      </header>
      <div className={drawer.open ? 'drawer-backdrop open' : 'drawer-backdrop'} onClick={() => drawer.setOpen(false)} aria-hidden="true" />

      <aside id="sidebar" ref={drawer.panel} className={drawer.open ? 'sidebar open' : 'sidebar'} aria-label="Menu">
        <div className="sidebar-head">
          <div className="brand">
            <img src="/kimi.png" alt="" />
            <span className="brand-name">KIMI</span>
          </div>
          <button type="button" className="icon-btn drawer-close" aria-label="Fechar menu" onClick={() => drawer.setOpen(false)}>
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <nav className="nav" aria-label="Seções">
          {GROUPS.map(group => (
            <div key={group.title} className="nav-group">
              <p className="nav-title">{group.title}</p>
              {group.items.map(({ to, label, icon: ItemIcon, end, badge }) => {
                const count = badge === 'openTickets' ? openTickets : 0;
                return (
                  <NavLink key={to} to={to} end={end} className="nav-item">
                    {({ isActive }) => (
                      <>
                        <ItemIcon size={20} weight={isActive ? 'fill' : 'bold'} aria-hidden="true" />
                        <span className="nav-label">{label}</span>
                        {count > 0 && (
                          <span className="nav-count" aria-label={`${count} aguardando`}>
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="account">
          <NavLink to="/configuracoes" className="account-link" title="Configurações da conta">
            <span className="avatar" aria-hidden="true">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span className="account-text">
              <span className="account-user">{displayName}</span>
              <span className="account-hint">Configurações</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="icon-btn"
            aria-label="Sair"
            title="Sair"
            onClick={() => void supabase.auth.signOut()}
          >
            <SignOut size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet context={{ name, setName } satisfies AccountContext} />
      </main>
    </div>
  );
}
