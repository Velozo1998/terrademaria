import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/',           label: 'Dashboard',   icon: '📊', exact: true },
  { path: '/produtos',   label: 'Produtos',    icon: '📿' },
  { path: '/vendas',     label: 'Vendas',      icon: '🛍️' },
  { path: '/compras',    label: 'Compras',     icon: '📦' },
  { path: '/estoque',    label: 'Estoque',     icon: '🗂️' },
  { path: '/financeiro', label: 'Financeiro',  icon: '💰' },
]

const pageTitles = {
  '/':           'Dashboard',
  '/produtos':   'Produtos',
  '/vendas':     'Vendas',
  '/compras':    'Compras',
  '/estoque':    'Estoque',
  '/financeiro': 'Financeiro',
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  const sidebarStyle = {
    width: 220,
    background: 'var(--sidebar-bg)',
    color: 'var(--bege)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 200,
    transition: 'transform 0.3s ease',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 199,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(200,169,106,0.2)',
        }}>
          <div style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--dourado)',
            lineHeight: 1.1,
          }}>
            Terra de Maria
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--marrom)',
            marginTop: 5,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}>
            Sistema de Gestão
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 20px',
                textDecoration: 'none',
                color: isActive ? 'var(--dourado)' : 'rgba(232,216,208,0.75)',
                background: isActive ? 'rgba(200,169,106,0.12)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--dourado)' : '3px solid transparent',
                fontSize: '13px',
                fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s',
                letterSpacing: '0.2px',
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer tagline */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(200,169,106,0.15)',
          fontSize: '11px',
          color: 'rgba(184,155,122,0.7)',
          fontStyle: 'italic',
          fontFamily: 'Cormorant Garamond, serif',
        }}>
          Fé que habita o lar ✨
        </div>
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        marginLeft: 220,
        minHeight: '100vh',
        background: 'var(--bege)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top bar */}
        <div style={{
          background: 'var(--branco)',
          borderBottom: '1px solid var(--bege-dark)',
          padding: '0 28px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <span style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '18px',
            color: 'var(--texto-leve)',
            fontWeight: 600,
          }}>
            {pageTitles[location.pathname] || 'Terra de Maria'}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{
            fontSize: '12px',
            color: 'var(--texto-leve)',
            background: 'var(--bege)',
            padding: '4px 12px',
            borderRadius: 20,
            fontWeight: 500,
          }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '28px', flex: 1 }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          aside { transform: translateX(${open ? '0' : '-100%'}); }
          main { margin-left: 0 !important; }
          .mobile-overlay { display: block !important; }
        }
      `}</style>
    </div>
  )
}
