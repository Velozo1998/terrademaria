import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const MODULOS = ['todos', 'produtos', 'vendas', 'compras', 'clientes', 'financeiro']

const moduloIcon = {
  produtos: '📿', vendas: '🛍️', compras: '📦',
  clientes: '👥', financeiro: '💰',
}

const acaoColor = {
  cadastrou:  'badge-success',
  editou:     'badge-dourado',
  excluiu:    'badge-danger',
  arquivou:   'badge-warning',
  restaurou:  'badge-verde',
  registrou:  'badge-success',
  atualizou:  'badge-dourado',
  vinculou:   'badge-nude',
  marcou:     'badge-success',
}

export default function Historico() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modulo, setModulo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('7')

  useEffect(() => { loadLogs() }, [modulo, periodo])

  async function loadLogs() {
    setLoading(true)
    let query = supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (modulo !== 'todos') query = query.eq('modulo', modulo)

    if (periodo !== 'todos') {
      const inicio = new Date()
      inicio.setDate(inicio.getDate() - Number(periodo))
      query = query.gte('created_at', inicio.toISOString())
    }

    const { data } = await query
    setLogs(data || [])
    setLoading(false)
  }

  const fmt = (d) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const nomeUsuario = (email) => {
    if (!email) return 'Sistema'
    const nome = email.split('@')[0]
    return nome.charAt(0).toUpperCase() + nome.slice(1)
  }

  const filtrados = logs.filter(l =>
    busca === '' ||
    l.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
    l.user_email?.toLowerCase().includes(busca.toLowerCase()) ||
    l.acao?.toLowerCase().includes(busca.toLowerCase())
  )

  const periodoLabel = { '1': 'Hoje', '7': 'Últimos 7 dias', '30': 'Últimos 30 dias', 'todos': 'Todo período' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Histórico</h2>
          <p className="page-subtitle">{filtrados.length} registro(s) · {periodoLabel[periodo]}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ maxWidth: 240, margin: 0 }}
            placeholder="🔍 Buscar ação, usuário..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MODULOS.map(m => (
              <button key={m} onClick={() => setModulo(m)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: modulo === m ? 'var(--dourado)' : 'var(--bege)',
                color: modulo === m ? 'white' : 'var(--texto-leve)',
                border: 'none', textTransform: 'capitalize', cursor: 'pointer',
              }}>
                {m === 'todos' ? 'Todos' : `${moduloIcon[m]} ${m}`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(periodoLabel).map(([k, v]) => (
              <button key={k} onClick={() => setPeriodo(k)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: periodo === k ? 'var(--texto)' : 'var(--bege)',
                color: periodo === k ? 'white' : 'var(--texto-leve)',
                border: 'none', cursor: 'pointer',
              }}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--texto-leve)', padding: 24 }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📋</div>
          <h3>Nenhum registro encontrado</h3>
          <p>As ações realizadas no sistema aparecerão aqui</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtrados.map(log => (
            <div key={log.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Ícone do módulo */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--bege-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {moduloIcon[log.modulo] || '📋'}
              </div>

              {/* Conteúdo */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{nomeUsuario(log.user_email)}</span>
                  <span className={`badge ${acaoColor[log.acao] || 'badge-nude'}`} style={{ fontSize: 11 }}>
                    {log.acao}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--texto-leve)', textTransform: 'capitalize' }}>
                    em {log.modulo}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--texto-leve)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.descricao}
                </div>
              </div>

              {/* Data */}
              <div style={{ fontSize: 11, color: 'var(--texto-leve)', whiteSpace: 'nowrap', textAlign: 'right', flexShrink: 0 }}>
                {fmt(log.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
