import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Vendas() {
  const [vendas, setVendas] = useState([])
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [carrinho, setCarrinho] = useState([])
  const [canal, setCanal] = useState('whatsapp')
  const [observacao, setObservacao] = useState('')
  const [produtoSel, setProdutoSel] = useState('')
  const [qtd, setQtd] = useState(1)
  const [preco, setPreco] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [detalhe, setDetalhe] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: v }, { data: p }] = await Promise.all([
      supabase.from('vendas')
        .select('*, itens_venda(quantidade, preco_unitario, produto_id, produtos(nome))')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
    ])
    setVendas(v || [])
    setProdutos(p || [])
    setLoading(false)
  }

  function abrirModal() {
    setCarrinho([])
    setCanal('whatsapp')
    setObservacao('')
    setProdutoSel('')
    setQtd(1)
    setPreco('')
    setModal(true)
  }

  function selecionarProduto(id) {
    setProdutoSel(id)
    const p = produtos.find(x => x.id === id)
    if (p) setPreco(p.preco_venda)
  }

  function adicionarItem() {
    if (!produtoSel) return showMsg('Selecione um produto', 'danger')
    if (!qtd || qtd <= 0) return showMsg('Informe a quantidade', 'danger')
    if (!preco || preco <= 0) return showMsg('Informe o preço', 'danger')

    const produto = produtos.find(p => p.id === produtoSel)
    if (!produto) return

    if (produto.estoque_atual < qtd) {
      return showMsg(`Estoque insuficiente. Disponível: ${produto.estoque_atual}`, 'danger')
    }

    const jaNoCarrinho = carrinho.find(i => i.produto_id === produtoSel)
    const totalQtd = (jaNoCarrinho?.quantidade || 0) + Number(qtd)
    if (totalQtd > produto.estoque_atual) {
      return showMsg(`Estoque insuficiente para ${totalQtd} unidades. Disponível: ${produto.estoque_atual}`, 'danger')
    }

    if (jaNoCarrinho) {
      setCarrinho(c => c.map(i => i.produto_id === produtoSel
        ? { ...i, quantidade: i.quantidade + Number(qtd) }
        : i
      ))
    } else {
      setCarrinho(c => [...c, {
        produto_id: produtoSel,
        nome: produto.nome,
        quantidade: Number(qtd),
        preco_unitario: Number(preco),
        estoque_atual: produto.estoque_atual,
      }])
    }
    setProdutoSel('')
    setQtd(1)
    setPreco('')
  }

  function removerItem(id) {
    setCarrinho(c => c.filter(i => i.produto_id !== id))
  }

  const totalCarrinho = carrinho.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)

  async function registrarVenda() {
    if (carrinho.length === 0) return showMsg('Adicione pelo menos um produto', 'danger')
    setSalvando(true)

    try {
      // Criar venda
      const { data: venda, error: errVenda } = await supabase
        .from('vendas')
        .insert({ canal, total: totalCarrinho, observacao })
        .select()
        .single()

      if (errVenda) throw errVenda

      // Inserir itens
      const itens = carrinho.map(i => ({
        venda_id: venda.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      }))
      await supabase.from('itens_venda').insert(itens)

      // Atualizar estoque e registrar movimentações
      for (const item of carrinho) {
        const prod = produtos.find(p => p.id === item.produto_id)
        await supabase.from('produtos')
          .update({ estoque_atual: prod.estoque_atual - item.quantidade })
          .eq('id', item.produto_id)

        await supabase.from('movimentacoes').insert({
          produto_id: item.produto_id,
          tipo: 'saida',
          motivo: 'venda',
          quantidade: item.quantidade,
          referencia_id: venda.id,
        })
      }

      // Lançamento financeiro
      await supabase.from('financeiro').insert({
        tipo: 'entrada',
        categoria: 'venda',
        descricao: `Venda ${carrinho.map(i => i.nome).join(', ')} via ${canal}`,
        valor: totalCarrinho,
        referencia_id: venda.id,
      })

      showMsg('Venda registrada com sucesso! 🎉', 'success')
      setModal(false)
      loadAll()
    } catch (e) {
      showMsg('Erro ao registrar venda: ' + e.message, 'danger')
    }
    setSalvando(false)
  }

  function showMsg(text, type = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const canalLabel = { whatsapp: '💬 WhatsApp', presencial: '🏪 Presencial', feira: '🎪 Feira' }
  const canalColor = { whatsapp: 'badge-verde', presencial: 'badge-dourado', feira: 'badge-nude' }

  // Totais do mês
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
  const vendasMes = vendas.filter(v => new Date(v.created_at) >= inicioMes)
  const totalMes = vendasMes.reduce((s, v) => s + Number(v.total), 0)

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Vendas</h2>
          <p className="page-subtitle">{vendasMes.length} vendas este mês · {fmt(totalMes)}</p>
        </div>
        <button className="btn btn-primary" onClick={abrirModal}>+ Registrar Venda</button>
      </div>

      {/* Resumo rápido */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {['whatsapp', 'presencial', 'feira'].map(c => {
          const vs = vendasMes.filter(v => v.canal === c)
          return (
            <div className="card" key={c} style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 4 }}>{canalLabel[c]}</div>
              <div style={{ fontSize: 20, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700 }}>{fmt(vs.reduce((s, v) => s + Number(v.total), 0))}</div>
              <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>{vs.length} venda(s)</div>
            </div>
          )
        })}
      </div>

      {loading ? (
        <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p>
      ) : vendas.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">🛍️</div>
          <h3>Nenhuma venda ainda</h3>
          <p>Registre a primeira venda clicando em "+ Registrar Venda"</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produtos</th>
                <th>Canal</th>
                <th>Qtd. Itens</th>
                <th>Total</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map(v => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(v)}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--texto-leve)', fontSize: 12 }}>
                    {new Date(v.created_at).toLocaleDateString('pt-BR')}
                    <br />
                    <span style={{ fontSize: 11 }}>{new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {v.itens_venda?.map(i => (
                      <span key={i.produto_id} style={{ display: 'block' }}>
                        {i.quantidade}x {i.produtos?.nome}
                      </span>
                    ))}
                  </td>
                  <td><span className={`badge ${canalColor[v.canal] || 'badge-nude'}`}>{canalLabel[v.canal] || v.canal}</span></td>
                  <td>{v.itens_venda?.reduce((s, i) => s + i.quantidade, 0)} un</td>
                  <td style={{ fontWeight: 700, color: 'var(--dourado-dark)' }}>{fmt(v.total)}</td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)' }}>{v.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova Venda */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>Nova Venda</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              {/* Canal */}
              <div className="form-group">
                <label className="form-label">Canal de Venda</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['whatsapp', 'presencial', 'feira'].map(c => (
                    <button
                      key={c}
                      onClick={() => setCanal(c)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: canal === c ? 'var(--dourado)' : 'var(--bege)',
                        color: canal === c ? 'white' : 'var(--texto-leve)',
                        border: canal === c ? 'none' : '1.5px solid var(--bege-dark)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {canalLabel[c]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selecionar produto */}
              <div style={{ background: 'var(--bege)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--texto-leve)', textTransform: 'uppercase' }}>Adicionar item</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px auto', gap: 8, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Produto</label>
                    <select className="form-input" value={produtoSel} onChange={e => selecionarProduto(e.target.value)}>
                      <option value="">Selecione...</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id} disabled={p.estoque_atual === 0}>
                          {p.nome} ({p.estoque_atual} em estoque)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Qtd</label>
                    <input className="form-input" type="number" min="1" value={qtd} onChange={e => setQtd(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Preço (R$)</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={preco} onChange={e => setPreco(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" style={{ height: 40 }} onClick={adicionarItem}>+</button>
                </div>
              </div>

              {/* Carrinho */}
              {carrinho.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-leve)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Itens da venda
                  </div>
                  {carrinho.map(item => (
                    <div key={item.produto_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', background: 'var(--branco)', borderRadius: 8, marginBottom: 6,
                      border: '1px solid var(--bege-dark)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>
                          {item.quantidade} un × {fmt(item.preco_unitario)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--dourado-dark)' }}>
                          {fmt(item.quantidade * item.preco_unitario)}
                        </span>
                        <button onClick={() => removerItem(item.produto_id)} style={{ background: 'none', color: 'var(--danger)', fontSize: 16 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <div style={{
                    marginTop: 8, padding: '12px 14px', background: '#F5EDD8', borderRadius: 8,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Total</span>
                    <span style={{ fontWeight: 700, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', color: 'var(--dourado-dark)' }}>
                      {fmt(totalCarrinho)}
                    </span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input className="form-input" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: cliente pediu embrulho para presente" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarVenda} disabled={salvando || carrinho.length === 0}>
                {salvando ? 'Registrando...' : `Confirmar Venda${carrinho.length > 0 ? ` · ${fmt(totalCarrinho)}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalhe venda */}
      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>Detalhe da Venda</h3>
              <button onClick={() => setDetalhe(null)} style={{ background: 'none', fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>DATA</span>{new Date(detalhe.created_at).toLocaleString('pt-BR')}</div>
                <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>CANAL</span>{canalLabel[detalhe.canal]}</div>
                <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>TOTAL</span><strong style={{ color: 'var(--dourado-dark)' }}>{fmt(detalhe.total)}</strong></div>
              </div>
              {detalhe.observacao && <div className="alert alert-warning">{detalhe.observacao}</div>}
              <div>
                {detalhe.itens_venda?.map(i => (
                  <div key={i.produto_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bege)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{i.quantidade}x {i.produtos?.nome}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(i.quantidade * i.preco_unitario)}</span>
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
