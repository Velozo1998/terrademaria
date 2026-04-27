import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const CATEGORIAS = ['terço', 'escapulário', 'pulseira', 'chaveiro', 'medalhão', 'kit', 'outros']

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editandoCompra, setEditandoCompra] = useState(null)
  const [itens, setItens] = useState([])
  const [fornecedor, setFornecedor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [qtd, setQtd] = useState(1)
  const [custo, setCusto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [detalhe, setDetalhe] = useState(null)

  // Busca produto
  const [buscaProduto, setBuscaProduto] = useState('')
  const [showDropProd, setShowDropProd] = useState(false)
  const [produtoSel, setProdutoSel] = useState(null)
  const dropProdRef = useRef(null)

  // Modal rápido de novo produto
  const [modalProduto, setModalProduto] = useState(false)
  const [formProduto, setFormProduto] = useState({ nome: '', categoria: 'terço', custo: '', preco_venda: '' })
  const [salvandoProduto, setSalvandoProduto] = useState(false)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    function handleClick(e) {
      if (dropProdRef.current && !dropProdRef.current.contains(e.target)) setShowDropProd(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('compras').select('*, itens_compra(quantidade, custo_unitario, produto_id, produtos(nome))').order('created_at', { ascending: false }).limit(50),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
    ])
    setCompras(c || [])
    setProdutos(p || [])
    setLoading(false)
  }

  // ─── Cadastro rápido de produto ───────────────────────
  async function salvarNovoProduto() {
    if (!formProduto.nome.trim()) return showMsg('Informe o nome do produto', 'danger')
    if (!formProduto.preco_venda) return showMsg('Informe o preço de venda', 'danger')
    setSalvandoProduto(true)
    const { data, error } = await supabase.from('produtos').insert({
      nome: formProduto.nome.trim(),
      categoria: formProduto.categoria,
      custo: Number(formProduto.custo) || 0,
      preco_venda: Number(formProduto.preco_venda),
      estoque_atual: 0,
      estoque_minimo: 5,
    }).select().single()

    if (error) {
      showMsg('Erro: ' + error.message, 'danger')
    } else {
      showMsg(`"${data.nome}" cadastrado!`, 'success')
      setModalProduto(false)
      setFormProduto({ nome: '', categoria: 'terço', custo: '', preco_venda: '' })
      const { data: novosP } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome')
      setProdutos(novosP || [])
      selecionarProdutoDrop(data)
      setCusto(data.custo || '')
    }
    setSalvandoProduto(false)
  }

  // Produto combobox
  const prodsFiltrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  ).slice(0, 8)

  function selecionarProdutoDrop(p) {
    setProdutoSel(p)
    setBuscaProduto(p.nome)
    setCusto(p.custo || '')
    setShowDropProd(false)
  }

  // ─── Compra ───────────────────────────────────────────
  function abrirNovaCompra() {
    setEditandoCompra(null)
    setItens([])
    setFornecedor('')
    setObservacao('')
    setBuscaProduto('')
    setProdutoSel(null)
    setQtd(1)
    setCusto('')
    setModal(true)
  }

  function abrirEditar(compra) {
    setEditandoCompra(compra)
    setFornecedor(compra.fornecedor || '')
    setObservacao(compra.observacao || '')
    const itensExistentes = compra.itens_compra.map(i => ({
      produto_id: i.produto_id,
      nome: i.produtos?.nome || '—',
      quantidade: i.quantidade,
      custo_unitario: i.custo_unitario,
      estoque_atual: produtos.find(p => p.id === i.produto_id)?.estoque_atual || 0,
    }))
    setItens(itensExistentes)
    setBuscaProduto('')
    setProdutoSel(null)
    setQtd(1)
    setCusto('')
    setModal(true)
  }

  function adicionarItem() {
    if (!produtoSel) return showMsg('Selecione um produto', 'danger')
    if (!qtd || qtd <= 0) return showMsg('Informe a quantidade', 'danger')
    if (custo === '' || custo < 0) return showMsg('Informe o custo unitário', 'danger')

    const produto = produtos.find(p => p.id === produtoSel.id)
    if (!produto) return

    const jaNoLista = itens.find(i => i.produto_id === produtoSel.id)
    if (jaNoLista) {
      setItens(prev => prev.map(i => i.produto_id === produtoSel.id ? { ...i, quantidade: i.quantidade + Number(qtd) } : i))
    } else {
      setItens(prev => [...prev, { produto_id: produtoSel.id, nome: produto.nome, quantidade: Number(qtd), custo_unitario: Number(custo), estoque_atual: produto.estoque_atual }])
    }
    setBuscaProduto('')
    setProdutoSel(null)
    setQtd(1)
    setCusto('')
  }

  function removerItem(id) { setItens(prev => prev.filter(i => i.produto_id !== id)) }

  const totalCompra = itens.reduce((s, i) => s + i.quantidade * i.custo_unitario, 0)

  async function salvarCompra() {
    if (itens.length === 0) return showMsg('Adicione pelo menos um produto', 'danger')
    setSalvando(true)
    try {
      if (editandoCompra) {
        for (const item of editandoCompra.itens_compra) {
          const prod = produtos.find(p => p.id === item.produto_id)
          if (prod) await supabase.from('produtos').update({ estoque_atual: prod.estoque_atual - item.quantidade }).eq('id', item.produto_id)
        }
        await supabase.from('itens_compra').delete().eq('compra_id', editandoCompra.id)
        await supabase.from('movimentacoes').delete().eq('referencia_id', editandoCompra.id)
        await supabase.from('compras').update({ fornecedor: fornecedor.trim() || 'Não informado', total: totalCompra, observacao }).eq('id', editandoCompra.id)
        await supabase.from('itens_compra').insert(itens.map(i => ({ compra_id: editandoCompra.id, produto_id: i.produto_id, quantidade: i.quantidade, custo_unitario: i.custo_unitario })))
        for (const item of itens) {
          const prod = produtos.find(p => p.id === item.produto_id)
          const itemOriginal = editandoCompra.itens_compra.find(i => i.produto_id === item.produto_id)
          const estoqueBase = (prod?.estoque_atual || 0) - (itemOriginal?.quantidade || 0)
          await supabase.from('produtos').update({ estoque_atual: estoqueBase + item.quantidade, custo: item.custo_unitario }).eq('id', item.produto_id)
          await supabase.from('movimentacoes').insert({ produto_id: item.produto_id, tipo: 'entrada', motivo: 'compra', quantidade: item.quantidade, referencia_id: editandoCompra.id })
        }
        await supabase.from('financeiro').update({ valor: totalCompra, descricao: `Compra: ${itens.map(i => i.nome).join(', ')} · Fornecedor: ${fornecedor || 'Não informado'}` }).eq('referencia_id', editandoCompra.id)
        showMsg('Compra atualizada!', 'success')
      } else {
        const { data: compra, error: errCompra } = await supabase.from('compras').insert({ fornecedor: fornecedor.trim() || 'Não informado', total: totalCompra, observacao }).select().single()
        if (errCompra) throw errCompra
        await supabase.from('itens_compra').insert(itens.map(i => ({ compra_id: compra.id, produto_id: i.produto_id, quantidade: i.quantidade, custo_unitario: i.custo_unitario })))
        for (const item of itens) {
          const prod = produtos.find(p => p.id === item.produto_id)
          await supabase.from('produtos').update({ estoque_atual: prod.estoque_atual + item.quantidade, custo: item.custo_unitario }).eq('id', item.produto_id)
          await supabase.from('movimentacoes').insert({ produto_id: item.produto_id, tipo: 'entrada', motivo: 'compra', quantidade: item.quantidade, referencia_id: compra.id, observacao: fornecedor || null })
        }
        await supabase.from('financeiro').insert({ tipo: 'saida', categoria: 'compra', descricao: `Compra: ${itens.map(i => i.nome).join(', ')} · Fornecedor: ${fornecedor || 'Não informado'}`, valor: totalCompra, referencia_id: compra.id })
        showMsg('Compra registrada! Estoque atualizado. 📦', 'success')
      }
      setModal(false)
      loadAll()
    } catch (e) {
      showMsg('Erro: ' + e.message, 'danger')
    }
    setSalvando(false)
  }

  async function excluirCompra(compra, e) {
    e.stopPropagation()
    if (!confirm('Excluir esta compra? O estoque dos produtos será descontado.')) return
    try {
      for (const item of compra.itens_compra) {
        const prod = produtos.find(p => p.id === item.produto_id)
        if (prod) await supabase.from('produtos').update({ estoque_atual: Math.max(0, prod.estoque_atual - item.quantidade) }).eq('id', item.produto_id)
      }
      await supabase.from('financeiro').delete().eq('referencia_id', compra.id)
      await supabase.from('movimentacoes').delete().eq('referencia_id', compra.id)
      await supabase.from('compras').delete().eq('id', compra.id)
      showMsg('Compra excluída e estoque ajustado.', 'success')
      loadAll()
    } catch (e) {
      showMsg('Erro ao excluir: ' + e.message, 'danger')
    }
  }

  function showMsg(text, type = 'success') { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000) }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
  const comprasMes = compras.filter(c => new Date(c.created_at) >= inicioMes)
  const totalMes = comprasMes.reduce((s, c) => s + Number(c.total), 0)

  const dropStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
    background: 'var(--branco)', border: '1.5px solid var(--bege-dark)',
    borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  }

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Compras</h2>
          <p className="page-subtitle">{comprasMes.length} compra(s) este mês · {fmt(totalMes)} investido</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovaCompra}>+ Registrar Compra</button>
      </div>

      {loading ? <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p> : compras.length === 0 ? (
        <div className="card empty-state"><div className="icon">📦</div><h3>Nenhuma compra registrada</h3><p>Registre a primeira compra clicando acima</p></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Fornecedor</th><th>Produtos</th><th>Total</th><th>Obs.</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
            </thead>
            <tbody>
              {compras.map(c => (
                <tr key={c.id} onClick={() => setDetalhe(c)} style={{ cursor: 'pointer' }}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--texto-leve)', fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td style={{ fontWeight: 500 }}>{c.fornecedor || '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.itens_compra?.map(i => <span key={i.produto_id} style={{ display: 'block' }}>{i.quantidade}x {i.produtos?.nome}</span>)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(c.total)}</td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)' }}>{c.observacao || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={e => { e.stopPropagation(); abrirEditar(c) }}>✏️ Editar</button>
                      <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={e => excluirCompra(c, e)}>🗑️ Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modal Compra ─── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>{editandoCompra ? 'Editar Compra' : 'Registrar Compra'}</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              {editandoCompra && (
                <div className="alert alert-warning">✏️ Editando compra de {new Date(editandoCompra.created_at).toLocaleDateString('pt-BR')} — o estoque será recalculado automaticamente.</div>
              )}

              <div className="form-group">
                <label className="form-label">Fornecedor</label>
                <input className="form-input" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor (opcional)" />
              </div>

              {/* Adicionar item com busca */}
              <div style={{ background: 'var(--bege)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--texto-leve)', textTransform: 'uppercase' }}>Adicionar item</div>
                  <button
                    onClick={() => setModalProduto(true)}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--dourado-dark)', background: '#F5EDD8', border: '1px solid var(--dourado)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                  >
                    + Cadastrar novo produto
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px auto', gap: 8, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Produto</label>
                    <div style={{ position: 'relative' }} ref={dropProdRef}>
                      <input
                        className="form-input"
                        style={{ margin: 0 }}
                        placeholder="🔍 Buscar produto..."
                        value={buscaProduto}
                        onChange={e => { setBuscaProduto(e.target.value); setShowDropProd(true); setProdutoSel(null); setCusto('') }}
                        onFocus={() => setShowDropProd(true)}
                      />
                      {showDropProd && buscaProduto.length > 0 && (
                        <div style={dropStyle}>
                          {prodsFiltrados.length === 0 ? (
                            <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--texto-leve)' }}>Nenhum produto encontrado</div>
                          ) : prodsFiltrados.map(p => (
                            <div key={p.id} style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--bege)' }} onMouseDown={() => selecionarProdutoDrop(p)}>
                              <strong>{p.nome}</strong>
                              <span style={{ color: 'var(--texto-leve)', fontSize: 11, marginLeft: 6 }}>({p.estoque_atual} em estoque)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {produtoSel && <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>✅ {produtoSel.nome}</div>}
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

              {/* Lista itens */}
              {itens.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-leve)', textTransform: 'uppercase', marginBottom: 8 }}>Itens da compra</div>
                  {itens.map(item => (
                    <div key={item.produto_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--branco)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--bege-dark)' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--texto-leve)' }}>
                          {item.quantidade} un × {fmt(item.custo_unitario)}
                          <span style={{ marginLeft: 6, color: 'var(--verde)', fontWeight: 600 }}>→ estoque: {item.estoque_atual} + {item.quantidade} = {item.estoque_atual + item.quantidade}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(item.quantidade * item.custo_unitario)}</span>
                        <button onClick={() => removerItem(item.produto_id)} style={{ background: 'none', color: 'var(--danger)', fontSize: 16 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--danger-light)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Total investido</span>
                    <span style={{ fontWeight: 700, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', color: 'var(--danger)' }}>{fmt(totalCompra)}</span>
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
              <button className="btn btn-primary" onClick={salvarCompra} disabled={salvando || itens.length === 0}>
                {salvando ? 'Salvando...' : editandoCompra ? 'Salvar Alterações' : `Confirmar Compra${itens.length > 0 ? ` · ${fmt(totalCompra)}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Cadastro Rápido de Produto ─── */}
      {modalProduto && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setModalProduto(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 20 }}>📿 Cadastrar Novo Produto</h3>
              <button onClick={() => setModalProduto(false)} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bege)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--texto-leve)', marginBottom: 4 }}>
                💡 O produto será adicionado à lista e já poderá ser selecionado na compra atual.
              </div>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-input" value={formProduto.nome} onChange={e => setFormProduto(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Medalha de São Bento" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" value={formProduto.categoria} onChange={e => setFormProduto(f => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Custo (R$)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={formProduto.custo} onChange={e => setFormProduto(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Preço de Venda (R$) *</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={formProduto.preco_venda} onChange={e => setFormProduto(f => ({ ...f, preco_venda: e.target.value }))} placeholder="0,00" />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--texto-leve)' }}>Estoque inicial será 0 — será atualizado ao confirmar a compra.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalProduto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarNovoProduto} disabled={salvandoProduto}>
                {salvandoProduto ? 'Cadastrando...' : 'Cadastrar e Selecionar'}
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