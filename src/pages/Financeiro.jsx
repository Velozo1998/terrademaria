import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CATEGORIAS_ENTRADA = ['venda', 'outra receita']
const CATEGORIAS_SAIDA   = ['compra', 'embalagem', 'frete', 'marketing', 'despesa fixa', 'outra despesa']

const emptyForm = { tipo: 'saida', categoria: 'embalagem', descricao: '', valor: '' }

export default function Financeiro() {
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [periodo, setPeriodo] = useState('mes') // 'mes' | '3meses' | 'todos'
  const [filtroTipo, setFiltroTipo] = useState('todos')

  useEffect(() => { loadLancamentos() }, [])

  async function loadLancamentos() {
    setLoading(true)
    const { data } = await supabase
      .from('financeiro')
      .select('*')
      .order('created_at', { ascending: false })
    setLancamentos(data || [])
    setLoading(false)
  }

  function filtrarPorPeriodo(items) {
    const now = new Date()
    return items.filter(l => {
      const d = new Date(l.created_at)
      if (periodo === 'mes') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      if (periodo === '3meses') {
        const inicio = new Date(); inicio.setMonth(inicio.getMonth() - 3)
        return d >= inicio
      }
      return true
    })
  }

  const filtrados = filtrarPorPeriodo(lancamentos).filter(l =>
    filtroTipo === 'todos' ? true : l.tipo === filtroTipo
  )

  const totalEntradas = filtrarPorPeriodo(lancamentos).filter(l => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0)
  const totalSaidas   = filtrarPorPeriodo(lancamentos).filter(l => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0)
  const saldo = totalEntradas - totalSaidas

  // Breakdown por categoria
  const categorias = {}
  filtrarPorPeriodo(lancamentos).forEach(l => {
    if (!categorias[l.categoria]) categorias[l.categoria] = { entrada: 0, saida: 0 }
    categorias[l.categoria][l.tipo] += Number(l.valor)
  })

  async function salvarLancamento() {
    if (!form.descricao.trim()) return showMsg('Informe a descrição', 'danger')
    if (!form.valor || Number(form.valor) <= 0) return showMsg('Informe o valor', 'danger')

    setSalvando(true)
    const { error } = await supabase.from('financeiro').insert({
      tipo: form.tipo,
      categoria: form.categoria,
      descricao: form.descricao.trim(),
      valor: Number(form.valor),
    })

    if (error) {
      showMsg('Erro: ' + error.message, 'danger')
    } else {
      showMsg('Lançamento registrado!', 'success')
      setModal(false)
      setForm(emptyForm)
      loadLancamentos()
    }
    setSalvando(false)
  }

  async function excluir(id) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('financeiro').delete().eq('id', id)
    loadLancamentos()
  }

  function showMsg(text, type = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const categoriaLabel = {
    venda: '🛍️ Venda',
    compra: '📦 Compra',
    embalagem: '🎁 Embalagem',
    frete: '🚚 Frete',
    marketing: '📱 Marketing',
    'despesa fixa': '💡 Despesa Fixa',
    'outra receita': '💰 Outra Receita',
    'outra despesa': '💸 Outra Despesa',
  }

  const periodoLabel = { mes: 'Este mês', '3meses': 'Últimos 3 meses', todos: 'Todo período' }

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Financeiro</h2>
          <p className="page-subtitle">Fluxo de caixa · {periodoLabel[periodo]}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Lançamento Manual</button>
      </div>

      {/* Cards principais */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 6 }}>Total de Entradas</div>
          <div style={{ fontSize: 28, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color: 'var(--success)' }}>{fmt(totalEntradas)}</div>
          <div style={{ fontSize: 11, color: 'var(--texto-leve)', marginTop: 4 }}>
            {filtrarPorPeriodo(lancamentos).filter(l => l.tipo === 'entrada').length} lançamentos
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 6 }}>Total de Saídas</div>
          <div style={{ fontSize: 28, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color: 'var(--danger)' }}>{fmt(totalSaidas)}</div>
          <div style={{ fontSize: 11, color: 'var(--texto-leve)', marginTop: 4 }}>
            {filtrarPorPeriodo(lancamentos).filter(l => l.tipo === 'saida').length} lançamentos
          </div>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${saldo >= 0 ? 'var(--dourado)' : 'var(--danger)'}` }}>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 6 }}>Saldo do Período</div>
          <div style={{ fontSize: 28, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color: saldo >= 0 ? 'var(--dourado-dark)' : 'var(--danger)' }}>
            {fmt(saldo)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--texto-leve)', marginTop: 4 }}>
            {saldo >= 0 ? '✅ Positivo' : '⚠️ Negativo'}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(periodoLabel).map(([k, v]) => (
              <button key={k} onClick={() => setPeriodo(k)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: periodo === k ? 'var(--texto)' : 'var(--bege)',
                color: periodo === k ? 'white' : 'var(--texto-leve)',
                border: 'none',
              }}>{v}</button>
            ))}
          </div>
          <div style={{ height: 20, width: 1, background: 'var(--bege-dark)' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[['todos', 'Todos'], ['entrada', '↑ Entradas'], ['saida', '↓ Saídas']].map(([k, v]) => (
              <button key={k} onClick={() => setFiltroTipo(k)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: filtroTipo === k ? (k === 'entrada' ? 'var(--success)' : k === 'saida' ? 'var(--danger)' : 'var(--dourado)') : 'var(--bege)',
                color: filtroTipo === k ? 'white' : 'var(--texto-leve)',
                border: 'none',
              }}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">💰</div>
          <h3>Nenhum lançamento</h3>
          <p>Os lançamentos de vendas e compras aparecem aqui automaticamente</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12, color: 'var(--texto-leve)', whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.descricao}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--texto-leve)' }}>
                        {categoriaLabel[l.categoria] || l.categoria}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${l.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                        {l.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: l.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)' }}>
                      {l.tipo === 'entrada' ? '+' : '-'}{fmt(l.valor)}
                    </td>
                    <td>
                      {!l.referencia_id && ( // só mostra excluir em lançamentos manuais
                        <button
                          onClick={() => excluir(l.id)}
                          style={{ background: 'none', color: 'var(--texto-leve)', fontSize: 16, opacity: 0.5 }}
                          title="Excluir"
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Subtotal visível */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 24,
            padding: '14px 16px', background: 'var(--branco)',
            borderTop: '2px solid var(--bege-dark)',
            borderRadius: '0 0 12px 12px',
            fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ color: 'var(--texto-leve)' }}>{filtrados.length} lançamentos</span>
            <span style={{ color: 'var(--success)' }}>+{fmt(filtrados.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+Number(l.valor),0))}</span>
            <span style={{ color: 'var(--danger)' }}>-{fmt(filtrados.filter(l=>l.tipo==='saida').reduce((s,l)=>s+Number(l.valor),0))}</span>
            <span style={{ color: saldo >= 0 ? 'var(--dourado-dark)' : 'var(--danger)', fontSize: 14 }}>
              = {fmt(filtrados.reduce((s,l) => l.tipo==='entrada' ? s+Number(l.valor) : s-Number(l.valor), 0))}
            </span>
          </div>
        </>
      )}

      {/* Modal Lançamento Manual */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>Lançamento Manual</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['entrada', 'saida'].map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        setForm(f => ({
                          ...f,
                          tipo: t,
                          categoria: t === 'entrada' ? 'outra receita' : 'embalagem',
                        }))
                      }}
                      style={{
                        flex: 1, padding: 10, borderRadius: 8, fontWeight: 600,
                        background: form.tipo === t ? (t === 'entrada' ? 'var(--success)' : 'var(--danger)') : 'var(--bege)',
                        color: form.tipo === t ? 'white' : 'var(--texto-leve)',
                        border: 'none', fontSize: 13,
                      }}
                    >
                      {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {(form.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(c => (
                    <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{categoriaLabel[c] || c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição *</label>
                <input className="form-input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Compra de embalagens kraft" />
              </div>

              <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input className="form-input" type="number" step="0.01" min="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarLancamento} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
