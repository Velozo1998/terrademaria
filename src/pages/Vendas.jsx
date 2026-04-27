import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Vendas() {
  const [vendas, setVendas] = useState([])
  const [produtos, setProdutos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editandoVenda, setEditandoVenda] = useState(null)
  const [carrinho, setCarrinho] = useState([])
  const [canal, setCanal] = useState('whatsapp')
  const [tipoPagamento, setTipoPagamento] = useState('avista')
  const [clienteId, setClienteId] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [produtoSel, setProdutoSel] = useState('')
  const [qtd, setQtd] = useState(1)
  const [preco, setPreco] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: v }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('vendas')
        .select('*, itens_venda(quantidade, preco_unitario, produto_id, produtos(nome)), clientes(nome, telefone)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setVendas(v || [])
    setProdutos(p || [])
    setClientes(c || [])
    setLoading(false)
  }

  function abrirNovaVenda() {
    setEditandoVenda(null)
    setCarrinho([])
    setCanal('whatsapp')
    setTipoPagamento('avista')
    setClienteId('')
    setDataVencimento('')
    setObservacao('')
    setProdutoSel('')
    setQtd(1)
    setPreco('')
    setModal(true)
  }

  function abrirEditar(venda) {
    setEditandoVenda(venda)
    setCanal(venda.canal)
    setTipoPagamento(venda.tipo_pagamento || 'avista')
    setClienteId(venda.cliente_id || '')
    setDataVencimento(venda.data_vencimento || '')
    setObservacao(venda.observacao || '')
    const itensCarrinho = venda.itens_venda.map(i => ({
      produto_id: i.produto_id,
      nome: i.produtos?.nome || '—',
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      estoque_atual: (produtos.find(p => p.id === i.produto_id)?.estoque_atual || 0) + i.quantidade,
    }))
    setCarrinho(itensCarrinho)
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
    const itemOriginal = editandoVenda?.itens_venda?.find(i => i.produto_id === produtoSel)
    const estoqueDisponivel = produto.estoque_atual + (itemOriginal?.quantidade || 0)
    const jaNoCarrinho = carrinho.find(i => i.produto_id === produtoSel)
    const totalQtd = (jaNoCarrinho?.quantidade || 0) + Number(qtd)
    if (totalQtd > estoqueDisponivel) return showMsg(`Estoque insuficiente. Disponível: ${estoqueDisponivel}`, 'danger')
    if (jaNoCarrinho) {
      setCarrinho(c => c.map(i => i.produto_id === produtoSel ? { ...i, quantidade: i.quantidade + Number(qtd) } : i))
    } else {
      setCarrinho(c => [...c, { produto_id: produtoSel, nome: produto.nome, quantidade: Number(qtd), preco_unitario: Number(preco), estoque_atual: estoqueDisponivel }])
    }
    setProdutoSel('')
    setQtd(1)
    setPreco('')
  }

  function removerItem(id) { setCarrinho(c => c.filter(i => i.produto_id !== id)) }

  const totalCarrinho = carrinho.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)

  async function salvarVenda() {
    if (carrinho.length === 0) return showMsg('Adicione pelo menos um produto', 'danger')
    if (tipoPagamento === 'prazo' && !clienteId) return showMsg('Selecione o cliente para venda a prazo', 'danger')
    if (tipoPagamento === 'prazo' && !dataVencimento) return showMsg('Informe a data de vencimento', 'danger')
    setSalvando(true)

    const statusPagamento = tipoPagamento === 'avista' ? 'pago' : 'pendente'
    const payload = {
      canal,
      total: totalCarrinho,
      observacao,
      tipo_pagamento: tipoPagamento,
      cliente_id: clienteId || null,
      data_vencimento: tipoPagamento === 'prazo' ? dataVencimento : null,
      status_pagamento: statusPagamento,
    }

    try {
      if (editandoVenda) {
        // Restaurar estoque dos itens originais
        for (const item of editandoVenda.itens_venda) {
          const prod = produtos.find(p => p.id === item.produto_id)
          if (prod) await supabase.from('produtos').update({ estoque_atual: prod.estoque_atual + item.quantidade }).eq('id', item.produto_id)
        }
        await supabase.from('itens_venda').delete().eq('venda_id', editandoVenda.id)
        await supabase.from('movimentacoes').delete().eq('referencia_id', editandoVenda.id)
        await supabase.from('vendas').update(payload).eq('id', editandoVenda.id)
        await supabase.from('itens_venda').insert(carrinho.map(i => ({ venda_id: editandoVenda.id, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario })))
        for (const item of carrinho) {
          const prod = produtos.find(p => p.id === item.produto_id)
          const estoqueAtualizado = (prod?.estoque_atual || 0) + (editandoVenda.itens_venda.find(i => i.produto_id === item.produto_id)?.quantidade || 0)
          await supabase.from('produtos').update({ estoque_atual: estoqueAtualizado - item.quantidade }).eq('id', item.produto_id)
          await supabase.from('movimentacoes').insert({ produto_id: item.produto_id, tipo: 'saida', motivo: 'venda', quantidade: item.quantidade, referencia_id: editandoVenda.id })
        }
        // Atualiza financeiro só se for à vista
        if (tipoPagamento === 'avista') {
          await supabase.from('financeiro').update({ valor: totalCarrinho, descricao: `Venda ${carrinho.map(i => i.nome).join(', ')} via ${canal}` }).eq('referencia_id', editandoVenda.id)
        } else {
          // Remove lançamento financeiro se mudou pra prazo
          await supabase.from('financeiro').delete().eq('referencia_id', editandoVenda.id)
        }
        showMsg('Venda atualizada!', 'success')

      } else {
        const { data: venda, error: errVenda } = await supabase.from('vendas').insert(payload).select().single()
        if (errVenda) throw errVenda
        await supabase.from('itens_venda').insert(carrinho.map(i => ({ venda_id: venda.id, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario })))
        for (const item of carrinho) {
          const prod = produtos.find(p => p.id === item.produto_id)
          await supabase.from('produtos').update({ estoque_atual: prod.estoque_atual - item.quantidade }).eq('id', item.produto_id)
          await supabase.from('movimentacoes').insert({ produto_id: item.produto_id, tipo: 'saida', motivo: 'venda', quantidade: item.quantidade, referencia_id: venda.id })
        }
        // Lança no financeiro só se for à vista
        if (tipoPagamento === 'avista') {
          await supabase.from('financeiro').insert({ tipo: 'entrada', categoria: 'venda', descricao: `Venda ${carrinho.map(i => i.nome).join(', ')} via ${canal}`, valor: totalCarrinho, referencia_id: venda.id })
        }
        showMsg(tipoPagamento === 'prazo' ? 'Venda a prazo registrada! 📋' : 'Venda registrada! 🎉', 'success')
      }

      setModal(false)
      loadAll()
    } catch (e) {
      showMsg('Erro: ' + e.message, 'danger')
    }
    setSalvando(false)
  }

  async function excluirVenda(venda, e) {
    e.stopPropagation()
    if (!confirm('Excluir esta venda? O estoque dos produtos será restaurado.')) return
    try {
      for (const item of venda.itens_venda) {
        const prod = produtos.find(p => p.id === item.produto_id)
        if (prod) await supabase.from('produtos').update({ estoque_atual: prod.estoque_atual + item.quantidade }).eq('id', item.produto_id)
      }
      await supabase.from('financeiro').delete().eq('referencia_id', venda.id)
      await supabase.from('movimentacoes').delete().eq('referencia_id', venda.id)
      await supabase.from('vendas').delete().eq('id', venda.id)
      showMsg('Venda excluída e estoque restaurado.', 'success')
      loadAll()
    } catch (e) {
      showMsg('Erro ao excluir: ' + e.message, 'danger')
    }
  }

  function showMsg(text, type = 'success') { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000) }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const canalLabel = { whatsapp: '💬 WhatsApp', presencial: '🏪 Presencial', feira: '🎪 Feira' }
  const canalColor = { whatsapp: 'badge-verde', presencial: 'badge-dourado', feira: 'badge-nude' }

  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
  const vendasMes = vendas.filter(v => new Date(v.created_at) >= inicioMes)
  const totalMes = vendasMes.filter(v => v.status_pagamento === 'pago').reduce((s, v) => s + Number(v.total), 0)
  const totalPrazo = vendasMes.filter(v => v.status_pagamento === 'pendente' || v.status_pagamento === 'vencido').reduce((s, v) => s + Number(v.total), 0)

  const statusBadge = (v) => {
    if (v.tipo_pagamento === 'avista') return { label: '✅ À vista', cls: 'badge-success' }
    if (v.status_pagamento === 'pago') return { label: '✅ Pago', cls: 'badge-success' }
    if (v.status_pagamento === 'vencido') return { label: '🔴 Vencido', cls: 'badge-danger' }
    return { label: '⏳ A prazo', cls: 'badge-warning' }
  }

  const filtradas = vendas.filter(v => {
    if (filtro === 'avista') return v.tipo_pagamento === 'avista'
    if (filtro === 'prazo') return v.tipo_pagamento === 'prazo'
    if (filtro === 'pendente') return v.status_pagamento === 'pendente' || v.status_pagamento === 'vencido'
    return true
  })

  // Data mínima para vencimento (amanhã)
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
  const dataMin = amanha.toISOString().split('T')[0]

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Vendas</h2>
          <p className="page-subtitle">{vendasMes.length} vendas este mês · {fmt(totalMes)} recebido{totalPrazo > 0 ? ` · ${fmt(totalPrazo)} a receber` : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovaVenda}>+ Registrar Venda</button>
      </div>

      {/* Cards resumo */}
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

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['todas','Todas'],['avista','✅ À vista'],['prazo','⏳ A prazo'],['pendente','🔴 Pendentes']].map(([k,l]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: filtro === k ? 'var(--dourado)' : 'var(--bege)',
              color: filtro === k ? 'white' : 'var(--texto-leve)', border: 'none',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p> : filtradas.length === 0 ? (
        <div className="card empty-state"><div className="icon">🛍️</div><h3>Nenhuma venda encontrada</h3></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Produtos</th><th>Cliente</th><th>Canal</th><th>Pagamento</th><th>Vencimento</th><th>Total</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
            </thead>
            <tbody>
              {filtradas.map(v => {
                const st = statusBadge(v)
                const vencido = v.status_pagamento === 'vencido'
                return (
                  <tr key={v.id} onClick={() => setDetalhe(v)} style={{ cursor: 'pointer', background: vencido ? '#FDF2F2' : undefined }}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--texto-leve)', fontSize: 12 }}>
                      {new Date(v.created_at).toLocaleDateString('pt-BR')}<br />
                      <span style={{ fontSize: 11 }}>{new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{v.itens_venda?.map(i => <span key={i.produto_id} style={{ display: 'block' }}>{i.quantidade}x {i.produtos?.nome}</span>)}</td>
                    <td style={{ fontSize: 12 }}>
                      {v.clientes ? <span style={{ fontWeight: 500 }}>👤 {v.clientes.nome}</span> : <span style={{ color: 'var(--texto-leve)' }}>—</span>}
                    </td>
                    <td><span className={`badge ${canalColor[v.canal] || 'badge-nude'}`}>{canalLabel[v.canal] || v.canal}</span></td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td style={{ fontSize: 12, color: vencido ? 'var(--danger)' : 'var(--texto-leve)', fontWeight: vencido ? 700 : 400 }}>
                      {v.data_vencimento ? new Date(v.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: v.tipo_pagamento === 'prazo' && v.status_pagamento !== 'pago' ? 'var(--warning)' : 'var(--dourado-dark)' }}>
                      {fmt(v.total)}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); abrirEditar(v) }}>✏️</button>
                        <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={(e) => excluirVenda(v, e)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova / Editar Venda */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>{editandoVenda ? 'Editar Venda' : 'Nova Venda'}</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              {editandoVenda && <div className="alert alert-warning">✏️ Editando venda — o estoque será recalculado automaticamente.</div>}

              {/* Canal */}
              <div className="form-group">
                <label className="form-label">Canal de Venda</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['whatsapp', 'presencial', 'feira'].map(c => (
                    <button key={c} onClick={() => setCanal(c)} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: canal === c ? 'var(--dourado)' : 'var(--bege)', color: canal === c ? 'white' : 'var(--texto-leve)', border: canal === c ? 'none' : '1.5px solid var(--bege-dark)' }}>
                      {canalLabel[c]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo pagamento */}
              <div className="form-group">
                <label className="form-label">Forma de Pagamento</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setTipoPagamento('avista')} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: tipoPagamento === 'avista' ? 'var(--success)' : 'var(--bege)', color: tipoPagamento === 'avista' ? 'white' : 'var(--texto-leve)', border: tipoPagamento === 'avista' ? 'none' : '1.5px solid var(--bege-dark)' }}>
                    ✅ À vista
                  </button>
                  <button onClick={() => setTipoPagamento('prazo')} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: tipoPagamento === 'prazo' ? 'var(--warning)' : 'var(--bege)', color: tipoPagamento === 'prazo' ? 'white' : 'var(--texto-leve)', border: tipoPagamento === 'prazo' ? 'none' : '1.5px solid var(--bege-dark)' }}>
                    📋 A prazo
                  </button>
                </div>
              </div>

              {/* Campos de prazo */}
              {tipoPagamento === 'prazo' && (
                <div style={{ background: '#FFF8EC', border: '1.5px solid var(--dourado)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dourado-dark)', textTransform: 'uppercase' }}>📋 Informações do prazo</div>
                  <div className="grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Cliente *</label>
                      <select className="form-input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                        <option value="">Selecione o cliente...</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Vencimento *</label>
                      <input className="form-input" type="date" min={dataMin} value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
                    </div>
                  </div>
                  {clientes.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--warning)' }}>⚠️ Nenhum cliente cadastrado. Cadastre um cliente na aba Clientes primeiro.</div>
                  )}
                </div>
              )}

              {/* Adicionar item */}
              <div style={{ background: 'var(--bege)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--texto-leve)', textTransform: 'uppercase' }}>Adicionar item</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px auto', gap: 8, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Produto</label>
                    <select className="form-input" value={produtoSel} onChange={e => selecionarProduto(e.target.value)}>
                      <option value="">Selecione...</option>
                      {produtos.map(p => <option key={p.id} value={p.id} disabled={p.estoque_atual === 0}>{p.nome} ({p.estoque_atual} em estoque)</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Qtd</label><input className="form-input" type="number" min="1" value={qtd} onChange={e => setQtd(e.target.value)} /></div>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Preço (R$)</label><input className="form-input" type="number" step="0.01" min="0" value={preco} onChange={e => setPreco(e.target.value)} /></div>
                  <button className="btn btn-primary" style={{ height: 40 }} onClick={adicionarItem}>+</button>
                </div>
              </div>

              {/* Carrinho */}
              {carrinho.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-leve)', textTransform: 'uppercase', marginBottom: 8 }}>Itens da venda</div>
                  {carrinho.map(item => (
                    <div key={item.produto_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--branco)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--bege-dark)' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>{item.quantidade} un × {fmt(item.preco_unitario)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--dourado-dark)' }}>{fmt(item.quantidade * item.preco_unitario)}</span>
                        <button onClick={() => removerItem(item.produto_id)} style={{ background: 'none', color: 'var(--danger)', fontSize: 16 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: '12px 14px', background: tipoPagamento === 'prazo' ? '#FFF8EC' : '#F5EDD8', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{tipoPagamento === 'prazo' ? '📋 Total a prazo' : 'Total'}</span>
                    <span style={{ fontWeight: 700, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', color: tipoPagamento === 'prazo' ? 'var(--warning)' : 'var(--dourado-dark)' }}>{fmt(totalCarrinho)}</span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input className="form-input" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: vai pagar na próxima feira" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarVenda} disabled={salvando || carrinho.length === 0}>
                {salvando ? 'Salvando...' : editandoVenda ? 'Salvar Alterações' : `Confirmar${carrinho.length > 0 ? ` · ${fmt(totalCarrinho)}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalhe */}
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
                {detalhe.clientes && <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>CLIENTE</span>{detalhe.clientes.nome}</div>}
                <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>TOTAL</span><strong style={{ color: 'var(--dourado-dark)' }}>{fmt(detalhe.total)}</strong></div>
                {detalhe.data_vencimento && <div><span style={{ fontSize: 11, color: 'var(--texto-leve)', display: 'block' }}>VENCIMENTO</span>{new Date(detalhe.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</div>}
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
