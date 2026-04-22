import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Estoque() {
  const [produtos, setProdutos] = useState([])
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAjuste, setModalAjuste] = useState(null)
  const [ajusteQtd, setAjusteQtd] = useState('')
  const [ajusteTipo, setAjusteTipo] = useState('entrada')
  const [ajusteMotivo, setAjusteMotivo] = useState('ajuste')
  const [ajusteObs, setAjusteObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [aba, setAba] = useState('estoque') // 'estoque' | 'historico'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('movimentacoes')
        .select('*, produtos(nome)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setProdutos(p || [])
    setMovs(m || [])
    setLoading(false)
  }

  function abrirAjuste(produto) {
    setModalAjuste(produto)
    setAjusteQtd('')
    setAjusteTipo('entrada')
    setAjusteMotivo('ajuste')
    setAjusteObs('')
  }

  async function salvarAjuste() {
    if (!ajusteQtd || Number(ajusteQtd) <= 0) return showMsg('Informe a quantidade', 'danger')

    const qtd = Number(ajusteQtd)
    const novoEstoque = ajusteTipo === 'entrada'
      ? modalAjuste.estoque_atual + qtd
      : modalAjuste.estoque_atual - qtd

    if (novoEstoque < 0) return showMsg('Estoque não pode ficar negativo', 'danger')

    setSalvando(true)
    try {
      await supabase.from('produtos').update({ estoque_atual: novoEstoque }).eq('id', modalAjuste.id)
      await supabase.from('movimentacoes').insert({
        produto_id: modalAjuste.id,
        tipo: ajusteTipo,
        motivo: ajusteMotivo,
        quantidade: qtd,
        observacao: ajusteObs || null,
      })
      showMsg('Estoque ajustado!', 'success')
      setModalAjuste(null)
      loadAll()
    } catch (e) {
      showMsg('Erro: ' + e.message, 'danger')
    }
    setSalvando(false)
  }

  function showMsg(text, type = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const estoqueStatus = (p) => {
    if (p.estoque_atual === 0) return { label: 'Zerado', cls: 'badge-danger', cor: 'var(--danger)' }
    if (p.estoque_atual <= p.estoque_minimo) return { label: 'Baixo', cls: 'badge-warning', cor: 'var(--warning)' }
    return { label: 'OK', cls: 'badge-success', cor: 'var(--success)' }
  }

  const filtrados = produtos.filter(p => {
    if (filtro === 'baixo') return p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo
    if (filtro === 'zerado') return p.estoque_atual === 0
    if (filtro === 'ok') return p.estoque_atual > p.estoque_minimo
    return true
  })

  const motivoLabel = {
    venda: '🛍️ Venda',
    compra: '📦 Compra',
    ajuste: '🔧 Ajuste',
    perda: '💔 Perda',
    brinde: '🎁 Brinde',
  }

  // Stats
  const zerados = produtos.filter(p => p.estoque_atual === 0).length
  const baixo = produtos.filter(p => p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo).length
  const ok = produtos.filter(p => p.estoque_atual > p.estoque_minimo).length
  const totalUnidades = produtos.reduce((s, p) => s + p.estoque_atual, 0)

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Estoque</h2>
          <p className="page-subtitle">{totalUnidades} unidades em estoque</p>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--success)' }}>
          <div style={{ fontSize: 24, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700 }}>{ok}</div>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>✅ Estoque OK</div>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: 24, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700 }}>{baixo}</div>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>⚠️ Estoque baixo</div>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontSize: 24, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700 }}>{zerados}</div>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>❌ Zerados</div>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--dourado)' }}>
          <div style={{ fontSize: 24, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700 }}>{totalUnidades}</div>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>📦 Total unidades</div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['estoque', 'historico'].map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: aba === a ? 'var(--dourado)' : 'var(--branco)',
              color: aba === a ? 'white' : 'var(--texto-leve)',
              border: '1.5px solid',
              borderColor: aba === a ? 'var(--dourado)' : 'var(--bege-dark)',
              textTransform: 'capitalize',
            }}
          >
            {a === 'estoque' ? '📦 Posição atual' : '📋 Histórico'}
          </button>
        ))}
      </div>

      {aba === 'estoque' && (
        <>
          {/* Filtros */}
          <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { v: 'todos', l: 'Todos' },
                { v: 'ok', l: '✅ OK' },
                { v: 'baixo', l: '⚠️ Baixo' },
                { v: 'zerado', l: '❌ Zerado' },
              ].map(f => (
                <button
                  key={f.v}
                  onClick={() => setFiltro(f.v)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: filtro === f.v ? 'var(--dourado)' : 'var(--bege)',
                    color: filtro === f.v ? 'white' : 'var(--texto-leve)',
                    border: 'none',
                  }}
                >
                  {f.l} {f.v !== 'todos' ? `(${produtos.filter(p => {
                    if (f.v === 'baixo') return p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo
                    if (f.v === 'zerado') return p.estoque_atual === 0
                    if (f.v === 'ok') return p.estoque_atual > p.estoque_minimo
                    return true
                  }).length})` : `(${produtos.length})`}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Estoque Atual</th>
                    <th>Mínimo</th>
                    <th>Barra</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ajuste</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(p => {
                    const st = estoqueStatus(p)
                    const pct = Math.min(100, p.estoque_minimo > 0 ? (p.estoque_atual / (p.estoque_minimo * 3)) * 100 : 50)
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.nome}</td>
                        <td>
                          <span className="badge badge-nude" style={{ textTransform: 'capitalize' }}>{p.categoria}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: 18, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color: st.cor }}>
                            {p.estoque_atual}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--texto-leve)' }}> un</span>
                        </td>
                        <td style={{ color: 'var(--texto-leve)', fontSize: 13 }}>{p.estoque_minimo}</td>
                        <td style={{ width: 120 }}>
                          <div style={{ background: 'var(--bege-dark)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 4,
                              width: `${pct}%`,
                              background: p.estoque_atual === 0 ? 'var(--danger)' : p.estoque_atual <= p.estoque_minimo ? 'var(--warning)' : 'var(--success)',
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </td>
                        <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => abrirAjuste(p)}>
                              Ajustar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba === 'historico' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Quantidade</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {movs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--texto-leve)' }}>Nenhuma movimentação registrada</td></tr>
              ) : movs.map(m => (
                <tr key={m.id}>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)', whiteSpace: 'nowrap' }}>
                    {new Date(m.created_at).toLocaleDateString('pt-BR')}
                    {' '}
                    {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ fontWeight: 500 }}>{m.produtos?.nome || '—'}</td>
                  <td>
                    <span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                      {m.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{motivoLabel[m.motivo] || m.motivo}</td>
                  <td style={{ fontWeight: 700, color: m.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)' }}>
                    {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)' }}>{m.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Ajuste */}
      {modalAjuste && (
        <div className="modal-overlay" onClick={() => setModalAjuste(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>Ajuste de Estoque</h3>
              <button onClick={() => setModalAjuste(null)} style={{ background: 'none', fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: 'var(--bege)', borderRadius: 8, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontWeight: 500 }}>{modalAjuste.nome}</span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 700 }}>
                  {modalAjuste.estoque_atual} <span style={{ fontSize: 13, color: 'var(--texto-leve)' }}>un atual</span>
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Ajuste</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['entrada', 'saida'].map(t => (
                    <button
                      key={t}
                      onClick={() => setAjusteTipo(t)}
                      style={{
                        flex: 1, padding: 10, borderRadius: 8, fontWeight: 600, fontSize: 13,
                        background: ajusteTipo === t ? (t === 'entrada' ? 'var(--success)' : 'var(--danger)') : 'var(--bege)',
                        color: ajusteTipo === t ? 'white' : 'var(--texto-leve)',
                        border: 'none',
                      }}
                    >
                      {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Motivo</label>
                <select className="form-input" value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)}>
                  <option value="ajuste">🔧 Ajuste manual</option>
                  <option value="perda">💔 Perda / avaria</option>
                  <option value="brinde">🎁 Brinde</option>
                  <option value="inventario">📋 Inventário</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quantidade</label>
                <input className="form-input" type="number" min="1" value={ajusteQtd} onChange={e => setAjusteQtd(e.target.value)} placeholder="0" />
              </div>

              {ajusteQtd && (
                <div style={{ background: 'var(--bege)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  Novo estoque: <strong style={{ fontSize: 16 }}>
                    {ajusteTipo === 'entrada'
                      ? modalAjuste.estoque_atual + Number(ajusteQtd)
                      : Math.max(0, modalAjuste.estoque_atual - Number(ajusteQtd))
                    }
                  </strong> unidades
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input className="form-input" value={ajusteObs} onChange={e => setAjusteObs(e.target.value)} placeholder="Motivo do ajuste..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalAjuste(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarAjuste} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Confirmar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
