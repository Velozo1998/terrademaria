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

export default function Layout() {
  const location = useLocation()
  const [pendentes, setPendentes] = useState(0)

  useEffect(() => { loadPendentes() }, [location.pathname])

  async function loadPendentes() {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('vendas')
      .select('id, data_vencimento, status_pagamento')
      .eq('tipo_pagamento', 'prazo')
      .eq('status_pagamento', 'pendente')
    if (data) {
      // Atualiza vencidos automaticamente
      const vencidos = data.filter(v => v.data_vencimento < hoje)
      for (const v of vencidos) {
        await supabase.from('vendas').update({ status_pagamento: 'vencido' }).eq('id', v.id)
      }
      setPendentes(data.length)
    }
  }

  const navItems = [
    { path: '/',           label: 'Dashboard',  icon: '📊', exact: true },
    { path: '/produtos',   label: 'Produtos',   icon: '📿' },
    { path: '/vendas',     label: 'Vendas',     icon: '🛍️' },
    { path: '/cobranças',  label: 'Cobranças',  icon: '🔔', badge: pendentes },
    { path: '/compras',    label: 'Compras',    icon: '📦' },
    { path: '/estoque',    label: 'Estoque',    icon: '🗂️' },
    { path: '/financeiro', label: 'Financeiro', icon: '💰' },
    { path: '/clientes',   label: 'Clientes',   icon: '👥' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: 'var(--sidebar-bg)', color: 'var(--bege)',
        display: 'flex', flexDirection: 'column', height: '100vh',
        position: 'fixed', top: 0, left: 0, zIndex: 200,
      }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(200,169,106,0.2)' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 700, color: 'var(--dourado)', lineHeight: 1.1 }}>
            Terra de Maria
          </div>
          <div style={{ fontSize: '10px', color: 'var(--marrom)', marginTop: 5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Sistema de Gestão
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 20px', textDecoration: 'none',
                color: isActive ? 'var(--dourado)' : 'rgba(232,216,208,0.75)',
                background: isActive ? 'rgba(200,169,106,0.12)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--dourado)' : '3px solid transparent',
                fontSize: '13px', fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s', letterSpacing: '0.2px',
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{
                  background: 'var(--danger)', color: 'white',
                  borderRadius: '50%', width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(200,169,106,0.15)', fontSize: '11px', color: 'rgba(184,155,122,0.7)', fontStyle: 'italic', fontFamily: 'Cormorant Garamond, serif' }}>
          Fé que habita o lar ✨
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh', background: 'var(--bege)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'var(--branco)', borderBottom: '1px solid var(--bege-dark)', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: 'var(--texto-leve)', fontWeight: 600 }}>
            {pageTitles[location.pathname] || 'Terra de Maria'}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: '12px', color: 'var(--texto-leve)', background: 'var(--bege)', padding: '4px 12px', borderRadius: 20, fontWeight: 500 }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </div>
        </div>
        <div style={{ padding: '28px', flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
