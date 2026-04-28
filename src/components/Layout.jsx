import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const pageTitles = {
  '/':           'Dashboard',
  '/produtos':   'Produtos',
  '/vendas':     'Vendas',
  '/compras':    'Compras',
  '/estoque':    'Estoque',
  '/financeiro': 'Financeiro',
  '/clientes':   'Clientes',
  '/cobranças':  'Cobranças',
}

export default function Layout({ user }) {
  const location = useLocation()
  const [pendentes, setPendentes] = useState(0)
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => { loadPendentes() }, [location.pathname])

  async function loadPendentes() {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('vendas')
      .select('id, data_vencimento, status_pagamento')
      .eq('tipo_pagamento', 'prazo')
      .neq('status_pagamento', 'pago')
    if (data) {
      const vencidos = data.filter(v => v.data_vencimento < hoje)
      for (const v of vencidos) {
        await supabase.from('vendas').update({ status_pagamento: 'vencido' }).eq('id', v.id)
      }
      setPendentes(data.length)
    }
  }

  async function sair() {
    await supabase.auth.signOut()
  }

  const navItems = [
    { path: '/',           label: 'Dashboard',  icon: '📊', exact: true },
    { path: '/produtos',   label: 'Produtos',   icon: '📿' },
    { path: '/vendas',     label: 'Vendas',     icon: '🛍️' },
    { path: '/compras',    label: 'Compras',    icon: '📦' },
    { path: '/estoque',    label: 'Estoque',    icon: '🗂️' },
    { path: '/financeiro', label: 'Financeiro', icon: '💰' },
    { path: '/clientes',   label: 'Clientes',   icon: '👥' },
    { path: '/cobranças',  label: 'Cobranças',  icon: '🔔', badge: pendentes > 0 ? pendentes : null },
    { path: '/historico',  label: 'Histórico',  icon: '📋' },
  ]

  const Sidebar = () => (
    <aside style={{
      width: 220, background: 'var(--sidebar-bg)', color: 'var(--bege)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'fixed', top: 0, left: 0, zIndex: 200,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(200,169,106,0.2)' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 700, color: 'var(--dourado)', lineHeight: 1.1 }}>
          Terra de Maria
        </div>
        <div style={{ fontSize: 10, color: 'var(--marrom)', marginTop: 5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
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
            onClick={() => setMenuAberto(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 20px', textDecoration: 'none',
              color: isActive ? 'var(--dourado)' : 'rgba(232,216,208,0.75)',
              background: isActive ? 'rgba(200,169,106,0.12)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--dourado)' : '3px solid transparent',
              fontSize: 13, fontWeight: isActive ? 600 : 400, transition: 'all 0.15s',
            })}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span style={{
                background: 'var(--danger)', color: 'white', borderRadius: 10,
                fontSize: 10, fontWeight: 700, padding: '1px 7px', minWidth: 18, textAlign: 'center',
              }}>{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Usuário + Logout */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(200,169,106,0.2)' }}>
        <div style={{ fontSize: 11, color: 'var(--marrom)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button
          onClick={sair}
          style={{
            width: '100%', padding: '8px', borderRadius: 8, fontSize: 12,
            background: 'rgba(200,169,106,0.1)', color: 'var(--marrom)',
            border: '1px solid rgba(200,169,106,0.2)', cursor: 'pointer',
            fontWeight: 500, transition: 'all 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(200,169,106,0.2)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(200,169,106,0.1)'}
        >
          🚪 Sair
        </button>
      </div>
    </aside>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar desktop */}
      <div className="sidebar-desktop">
        <Sidebar />
      </div>

      {/* Menu mobile overlay */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
        />
      )}

      {/* Sidebar mobile */}
      <div style={{
        position: 'fixed', top: 0, left: menuAberto ? 0 : -240,
        zIndex: 200, transition: 'left 0.25s',
        display: 'none',
      }} className="sidebar-mobile">
        <Sidebar />
      </div>

      {/* Conteúdo principal */}
      <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh', background: 'var(--bege)' }} className="main-content">
        {/* Header mobile */}
        <div className="mobile-header" style={{
          display: 'none', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--sidebar-bg)', position: 'sticky', top: 0, zIndex: 100,
        }}>
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            style={{ background: 'none', color: 'var(--dourado)', fontSize: 22, border: 'none', cursor: 'pointer', padding: 4 }}
          >
            ☰
          </button>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: 'var(--dourado)', fontWeight: 700 }}>
            Terra de Maria
          </span>
          <button onClick={sair} style={{ background: 'none', color: 'var(--marrom)', fontSize: 18, border: 'none', cursor: 'pointer', padding: 4 }}>
            🚪
          </button>
        </div>

        <div style={{ padding: '28px 32px' }} className="page-content">
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile { display: block !important; }
          .mobile-header { display: flex !important; }
          .main-content { margin-left: 0 !important; }
          .page-content { padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}
