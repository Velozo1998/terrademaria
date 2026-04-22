import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [itens, setItens] = useState([])
  const [fornecedor, setFornecedor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [produtoSel, setProdutoSel] = useState('')
  const [qtd, setQtd] = useState(1)
  const [custo, setCusto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [detalhe, setDetalhe] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('compras')
        .select('*, itens_compra(quantidade, custo_unitario, produto_id, produtos(nome))')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
    ])
    setCompras(c || [])
    setProdutos(p || [])
    setLoading(false)
  }

  function abrirModal() {
    setItens([])
    setFornecedor('')
    setObservacao('')
    setProdutoSel('')
    setQtd(1)
    setCusto('')
    setModal(true)
  }

  function selecionarProduto(id) {
    setProdutoSel(id)
    const p = produtos.find(x => x.id === id)
    if (p) setCusto(p.custo || '')
  }

  function adicionarItem() {
    if (!produtoSel) return showMsg('Selecione um produto', 'danger')
    if (!qtd || qtd <= 0) return showMsg('Informe a quantidade', 'danger')
    if (!custo || custo < 0) return showMsg('Informe o custo unitário', 'danger')

    const produto = produtos.find(p => p.id === produtoSel)
    if (!produto) return

    const jaNoLista = itens.find(i => i.produto_id === produtoSel)
    if (jaNoLista) {
      setItens(prev => prev.map(i => i.produto_id === produtoSel
        ? { ...i, quantidade: i.quantidade + Number(qtd) }
        : i
      ))
    } else {
      setItens(prev => [...prev, {
        produto_id: produtoSel,
        nome: produto.nome,
        quantidade: Number(qtd),
        custo_unitario: Number(custo),
        estoque_atual: produto.estoque_atual,
      }])
    }
    setProdutoSel('')
    setQtd(1)
    setCusto('')
  }

  function removerItem(id) {
    setItens(prev => prev.filter(i => i.produto_id !== id))
  }

  const totalCompra = itens.reduce((s, i) => s + i.quantidade * i.custo_unitario, 0)

  async function registrarCompra() {
    if (itens.length === 0) return showMsg('Adicione pelo menos um produto', 'danger')
    setSalvando(true)

    try {
      // Criar compra
      const { data: compra, error: errCompra } = await supabase
        .from('compras')
        .insert({ fornecedor: fornecedor.trim() || 'Não informado', total: totalCompra, observacao })
        .select()
        .single()

      if (errCompra) throw errCompra

      // Inserir itens
      const itemsInsert = itens.map(i => ({
        compra_id: compra.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        custo_unitario: i.custo_unitario,
      }))
      await supabase.from('itens_compra').insert(itemsInsert)

      // Atualizar estoque e movimentações
      for (const item of itens) {
        const prod = produtos.find(p => p.id === item.produto_id)
        await supabase.from('produtos')
          .update({
            estoque_atual: prod.estoque_atual + item.quantidade,
            custo: item.custo_unitario, // atualiza custo unitário
          })
          .eq('id', item.produto_id)

        await supabase.from('movimentacoes').insert({
          produto_id: item.produto_id,
          tipo: 'entrada',
          motivo: 'compra',
          quantidade: item.quantidade,
          referencia_id: compra.id,
          observacao: fornecedor || null,
        })
      }

      // Lançamento financeiro (saída)
      await supabase.from('financeiro').insert({
        tipo: 'saida',
        categoria: 'compra',
        descricao: `Compra: ${itens.map(i => i.nome).join(', ')} · Fornecedor: ${fornecedor || 'Não informado'}`,
        valor: totalCompra,
        referencia_id: compra.id,
      })

      showMsg('Compra registrada! Estoque atualizado. 📦', 'success')
      setModal(false)
      loadAll()
    } catch (e) {
      showMsg('Erro ao registrar compra: ' + e.message, 'danger')
    }
    setSalvando(false)
  }

  function showMsg(text, type = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  // Totais do mês
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
  const comprasMes = compras.filter(c => new Date(c.created_at) >= inicioMes)
  const totalMes = comprasMes.reduce((s, c) => s + Number(c.total), 0)

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Compras</h2>
          <p className="page-subtitle">{comprasMes.length} compra(s) este mês · {fmt(totalMes)} investido</p>
        </div>
        <button className="btn btn-primary" onClick={abrirModal}>+ Registrar Compra</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p>
      ) : compras.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📦</div>
          <h3>Nenhuma compra registrada</h3>
          <p>Registre a primeira compra de mercadoria clicando acima</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Fornecedor</th>
                <th>Produtos</th>
                <th>Qtd. Itens</th>
                <th>Total</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {compras.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(c)}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--texto-leve)', fontSize: 12 }}>
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ fontWeight: 500 }}>{c.fornecedor || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    {c.itens_compra?.map(i => (
                      <span key={i.produto_id} style={{ display: 'block' }}>
                        {i.quantidade}x {i.produtos?.nome}
                      </span>
                    ))}
                  </td>
                  <td>{c.itens_compra?.reduce((s, i) => s + i.quantidade, 0)} un</td>
                  <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(c.total)}</td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)' }}>{c.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova Compra */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>Registrar Compra</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Fornecedor</label>
                <input className="form-input" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor (opcional)" />
              </div>

              {/* Adicionar item */}
              <div style={{ background: 'var(--bege)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--texto-leve)', textTransform: 'uppercase' }}>Adicionar item</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px auto', gap: 8, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Produto</label>
                    <select className="form-input" value={produtoSel} onChange={e => selecionarProduto(e.target.value)}>
                      <option value="">Selecione...</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Qtd</label>
                    <input className="form-input" type="number" min="1" value={qtd} onChange={e => setQtd(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Custo unit. (R$)</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={custo} onChange={e => setCusto(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" style={{ height: 40 }} onClick={adicionarItem}>+</button>
                </div>
              </div>

              {/* Lista de itens */}
              {itens.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-leve)', textTransform: 'uppercase', marginBottom: 8 }}>Itens da compra</div>
                  {itens.map(item => (
                    <div key={item.produto_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', background: 'var(--branco)', borderRadius: 8, marginBottom: 6,
                      border: '1px solid var(--bege-dark)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>
                          {item.quantidade} un × {fmt(item.custo_unitario)}
                          <span style={{ marginLeft: 6, color: 'var(--verde)', fontWeight: 600 }}>
                            → estoque: {item.estoque_atual} + {item.quantidade} = {item.estoque_atual + item.quantidade}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                          {fmt(item.quantidade * item.custo_unitario)}
                        </span>
                        <button onClick={() => removerItem(item.produto_id)} style={{ background: 'none', color: 'var(--danger)', fontSize: 16 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <div style={{
                    marginTop: 8, padding: '12px 14px', background: 'var(--danger-light)', borderRadius: 8,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Total investido</span>
                    <span style={{ fontWeight: 700, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', color: 'var(--danger)' }}>
                      {fmt(totalCompra)}
                    </span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input className="form-input" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: compra pra festa de NS Aparecida" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarCompra} disabled={salvando || itens.length === 0}>
                {salvando ? 'Salvando...' : `Confirmar Compra${itens.length > 0 ? ` · ${fmt(totalCompra)}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalhe compra */}
      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>Detalhe da Compra</h3>
              <button onClick={() => setDetalhe(null)} style={{ background: 'none', fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>DATA</span>{new Date(detalhe.created_at).toLocaleString('pt-BR')}</div>
                <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>FORNECEDOR</span>{detalhe.fornecedor || '—'}</div>
                <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>TOTAL</span><strong style={{ color: 'var(--danger)' }}>{fmt(detalhe.total)}</strong></div>
              </div>
              {detalhe.observacao && <div className="alert alert-warning">{detalhe.observacao}</div>}
              <div>
                {detalhe.itens_compra?.map(i => (
                  <div key={i.produto_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bege)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{i.quantidade}x {i.produtos?.nome} ({fmt(i.custo_unitario)}/un)</span>
                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmt(i.quantidade * i.custo_unitario)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
