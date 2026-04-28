import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { registrarLog } from '../logger'

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
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [filtro, setFiltro] = useState('todas')

  const [modoBusca, setModoBusca] = useState('lista') // 'lista' | 'busca'

  // Busca produto
  const [buscaProduto, setBuscaProduto] = useState('')
  const [showDropProd, setShowDropProd] = useState(false)
  const [produtoSel, setProdutoSel] = useState(null) // objeto produto
  const [qtd, setQtd] = useState(1)
  const [preco, setPreco] = useState('')
  const dropProdRef = useRef(null)

  // Cliente à vista (opcional)
  const [mostrarCliente, setMostrarCliente] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [showDropCliente, setShowDropCliente] = useState(false)
  const [clienteSel, setClienteSel] = useState(null) // objeto cliente
  const dropClienteRef = useRef(null)

  // Cadastro rápido de cliente
  const [modalNovoCliente, setModalNovoCliente] = useState(false)
  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '' })
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  // Desconto
  const [tipoDesconto, setTipoDesconto] = useState('percent') // 'percent' | 'valor'
  const [desconto, setDesconto] = useState('')

  // Comprovante
  const [comprovante, setComprovante] = useState(null)

  // Vincular cliente (pós-venda)
  const [modalVincular, setModalVincular] = useState(false)
  const [vendaVincular, setVendaVincular] = useState(null)
  const [buscaVincular, setBuscaVincular] = useState('')
  const [clienteVincular, setClienteVincular] = useState(null)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    function handleClick(e) {
      if (dropProdRef.current && !dropProdRef.current.contains(e.target)) setShowDropProd(false)
      if (dropClienteRef.current && !dropClienteRef.current.contains(e.target)) setShowDropCliente(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

  function resetModal() {
    setCarrinho([])
    setCanal('whatsapp')
    setTipoPagamento('avista')
    setClienteId('')
    setDataVencimento('')
    setObservacao('')
    setBuscaProduto('')
    setProdutoSel(null)
    setQtd(1)
    setPreco('')
    setMostrarCliente(false)
    setBuscaCliente('')
    setClienteSel(null)
    setDesconto('')
    setTipoDesconto('percent')
    setModoBusca('lista')
  }

  function abrirNovaVenda() {
    setEditandoVenda(null)
    resetModal()
    setModal(true)
  }

  function abrirEditar(venda) {
    setEditandoVenda(venda)
    setCanal(venda.canal)
    setTipoPagamento(venda.tipo_pagamento || 'avista')
    setClienteId(venda.cliente_id || '')
    setDataVencimento(venda.data_vencimento || '')
    setObservacao(venda.observacao || '')
    setBuscaProduto('')
    setProdutoSel(null)
    setQtd(1)
    setPreco('')
    setDesconto('')
    setTipoDesconto('percent')
    if (venda.cliente_id) {
      const cli = clientes.find(c => c.id === venda.cliente_id)
      setClienteSel(cli || null)
      setBuscaCliente(cli?.nome || '')
      setMostrarCliente(true)
    } else {
      setClienteSel(null)
      setBuscaCliente('')
      setMostrarCliente(false)
    }
    const itensCarrinho = venda.itens_venda.map(i => ({
      produto_id: i.produto_id,
      nome: i.produtos?.nome || '—',
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      estoque_atual: (produtos.find(p => p.id === i.produto_id)?.estoque_atual || 0) + i.quantidade,
    }))
    setCarrinho(itensCarrinho)
    setModal(true)
  }

  // Produto combobox
  const prodsFiltrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  ).slice(0, 8)

  function selecionarProdutoDrop(p) {
    setProdutoSel(p)
    setBuscaProduto(p.nome)
    setPreco(p.preco_venda)
    setShowDropProd(false)
  }

  function adicionarItem() {
    if (!produtoSel) return showMsg('Selecione um produto', 'danger')
    if (!qtd || qtd <= 0) return showMsg('Informe a quantidade', 'danger')
    if (!preco || preco <= 0) return showMsg('Informe o preço', 'danger')
    const produto = produtos.find(p => p.id === produtoSel.id)
    if (!produto) return
    const itemOriginal = editandoVenda?.itens_venda?.find(i => i.produto_id === produtoSel.id)
    const estoqueDisponivel = produto.estoque_atual + (itemOriginal?.quantidade || 0)
    const jaNoCarrinho = carrinho.find(i => i.produto_id === produtoSel.id)
    const totalQtd = (jaNoCarrinho?.quantidade || 0) + Number(qtd)
    if (totalQtd > estoqueDisponivel) return showMsg(`Estoque insuficiente. Disponível: ${estoqueDisponivel}`, 'danger')
    if (jaNoCarrinho) {
      setCarrinho(c => c.map(i => i.produto_id === produtoSel.id ? { ...i, quantidade: i.quantidade + Number(qtd) } : i))
    } else {
      setCarrinho(c => [...c, { produto_id: produtoSel.id, nome: produto.nome, quantidade: Number(qtd), preco_unitario: Number(preco), estoque_atual: estoqueDisponivel }])
    }
    setBuscaProduto('')
    setProdutoSel(null)
    setQtd(1)
    setPreco('')
  }

  function removerItem(id) { setCarrinho(c => c.filter(i => i.produto_id !== id)) }

  // Cliente combobox
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
    (c.telefone || '').includes(buscaCliente)
  ).slice(0, 6)

  function selecionarClienteDrop(c) {
    setClienteSel(c)
    setClienteId(c.id)
    setBuscaCliente(c.nome)
    setShowDropCliente(false)
  }

  function limparCliente() {
    setClienteSel(null)
    setClienteId('')
    setBuscaCliente('')
  }

  // Cadastro rápido de cliente
  async function salvarNovoCliente() {
    if (!formCliente.nome.trim()) return showMsg('Informe o nome', 'danger')
    if (!formCliente.telefone.trim()) return showMsg('Informe o telefone', 'danger')
    setSalvandoCliente(true)
    const { data, error } = await supabase.from('clientes').insert({
      nome: formCliente.nome.trim(),
      telefone: formCliente.telefone.trim(),
    }).select().single()
    if (error) {
      showMsg('Erro: ' + error.message, 'danger')
    } else {
      const novosC = [...clientes, data].sort((a, b) => a.nome.localeCompare(b.nome))
      setClientes(novosC)
      selecionarClienteDrop(data)
      setModalNovoCliente(false)
      setFormCliente({ nome: '', telefone: '' })
      showMsg(`Cliente "${data.nome}" cadastrado!`, 'success')
    }
    setSalvandoCliente(false)
  }

  // Desconto calculado
  const subtotal = carrinho.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const descontoValor = (() => {
    if (!desconto || Number(desconto) <= 0) return 0
    if (tipoDesconto === 'percent') return subtotal * (Number(desconto) / 100)
    return Math.min(Number(desconto), subtotal)
  })()
  const totalCarrinho = Math.max(0, subtotal - descontoValor)

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
        if (tipoPagamento === 'avista') {
          await supabase.from('financeiro').update({ valor: totalCarrinho, descricao: `Venda ${carrinho.map(i => i.nome).join(', ')} via ${canal}` }).eq('referencia_id', editandoVenda.id)
        } else {
          await supabase.from('financeiro').delete().eq('referencia_id', editandoVenda.id)
        }
        showMsg('Venda atualizada!', 'success')
        await registrarLog({ acao: 'editou', modulo: 'vendas', descricao: `Venda editada · ${carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ')} · ${fmt(totalCarrinho)}`, referencia_id: editandoVenda.id })
      } else {
        const { data: venda, error: errVenda } = await supabase.from('vendas').insert(payload).select().single()
        if (errVenda) throw errVenda
        await supabase.from('itens_venda').insert(carrinho.map(i => ({ venda_id: venda.id, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario })))
        for (const item of carrinho) {
          const prod = produtos.find(p => p.id === item.produto_id)
          await supabase.from('produtos').update({ estoque_atual: prod.estoque_atual - item.quantidade }).eq('id', item.produto_id)
          await supabase.from('movimentacoes').insert({ produto_id: item.produto_id, tipo: 'saida', motivo: 'venda', quantidade: item.quantidade, referencia_id: venda.id })
        }
        if (tipoPagamento === 'avista') {
          await supabase.from('financeiro').insert({ tipo: 'entrada', categoria: 'venda', descricao: `Venda ${carrinho.map(i => i.nome).join(', ')} via ${canal}`, valor: totalCarrinho, referencia_id: venda.id })
        }

        // Abre comprovante
        setComprovante({
          id: venda.id,
          data: new Date().toLocaleString('pt-BR'),
          cliente: clienteSel,
          canal,
          tipoPagamento,
          dataVencimento,
          itens: [...carrinho],
          subtotal,
          descontoValor,
          tipoDesconto,
          descontoPercent: tipoDesconto === 'percent' ? Number(desconto) : (subtotal > 0 ? (descontoValor / subtotal * 100) : 0),
          total: totalCarrinho,
          observacao,
        })
        showMsg(tipoPagamento === 'prazo' ? 'Venda a prazo registrada! 📋' : 'Venda registrada! 🎉', 'success')
        await registrarLog({ acao: 'registrou', modulo: 'vendas', descricao: `Venda de ${carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ')} · ${fmt(totalCarrinho)} · ${tipoPagamento === 'prazo' ? 'a prazo' : 'à vista'}`, referencia_id: venda.id })
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
      await registrarLog({ acao: 'excluiu', modulo: 'vendas', descricao: `Venda excluída · ${venda.itens_venda?.map(i => i.produtos?.nome).join(', ')} · ${fmt(venda.total)}`, referencia_id: venda.id })
      loadAll()
    } catch (e) {
      showMsg('Erro ao excluir: ' + e.message, 'danger')
    }
  }

  // Vincular cliente pós-venda
  async function salvarVincularCliente() {
    if (!clienteVincular) return showMsg('Selecione um cliente', 'danger')
    const { error } = await supabase.from('vendas').update({ cliente_id: clienteVincular.id }).eq('id', vendaVincular.id)
    if (error) return showMsg('Erro: ' + error.message, 'danger')
    showMsg(`Cliente ${clienteVincular.nome} vinculado!`, 'success')
    await registrarLog({ acao: 'vinculou', modulo: 'vendas', descricao: `Cliente ${clienteVincular.nome} vinculado à venda`, referencia_id: vendaVincular.id })
    setModalVincular(false)
    setVendaVincular(null)
    setClienteVincular(null)
    setBuscaVincular('')
    loadAll()
  }

  function imprimirComprovante(c) {
    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write(`
      <html><head><title>Comprovante Terra de Maria</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; padding: 20px; max-width: 320px; margin: 0 auto; }
        h2 { text-align: center; font-size: 18px; margin: 0 0 4px; }
        .sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 16px; }
        .linha { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #eee; }
        .total { font-weight: bold; font-size: 16px; margin-top: 8px; }
        .rodape { text-align: center; margin-top: 20px; color: #888; font-size: 11px; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>Terra de Maria</h2>
      <div class="sub">Artigos Religiosos · Marilândia do Sul / PR</div>
      <div class="linha"><span>Data</span><span>${c.data}</span></div>
      ${c.cliente ? `<div class="linha"><span>Cliente</span><span>${c.cliente.nome}</span></div>` : ''}
      <div class="linha"><span>Canal</span><span>${{ whatsapp: 'WhatsApp', presencial: 'Presencial', feira: 'Feira' }[c.canal]}</span></div>
      <div class="linha"><span>Pagamento</span><span>${c.tipoPagamento === 'avista' ? 'À vista' : 'A prazo'}</span></div>
      ${c.dataVencimento ? `<div class="linha"><span>Vencimento</span><span>${new Date(c.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>` : ''}
      <br/>
      ${c.itens.map(i => `<div class="linha"><span>${i.quantidade}x ${i.nome}</span><span>R$ ${(i.quantidade * i.preco_unitario).toFixed(2).replace('.', ',')}</span></div>`).join('')}
      <br/>
      ${c.descontoValor > 0 ? `
        <div class="linha"><span>Subtotal</span><span>R$ ${c.subtotal.toFixed(2).replace('.', ',')}</span></div>
        <div class="linha"><span>Desconto${c.tipoDesconto === 'percent' ? ` (${c.descontoPercent.toFixed(0)}%)` : ''}</span><span>- R$ ${c.descontoValor.toFixed(2).replace('.', ',')}</span></div>
      ` : ''}
      <div class="linha total"><span>TOTAL</span><span>R$ ${c.total.toFixed(2).replace('.', ',')}</span></div>
      ${c.observacao ? `<div style="margin-top:12px;font-size:11px;color:#666">Obs: ${c.observacao}</div>` : ''}
      <div class="rodape">Obrigada pela preferência! 🙏<br/>Que Nossa Senhora abençoe você.</div>
      <br/><button onclick="window.print()">🖨️ Imprimir</button>
      </body></html>
    `)
    win.document.close()
  }

  function showMsg(text, type = 'success') { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000) }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const canalLabel = { whatsapp: '💬 WhatsApp', presencial: '🏪 Presencial', feira: '🎪 Feira' }
  const canalColor = { whatsapp: 'badge-verde', presencial: 'badge-dourado', feira: 'badge-nude' }

  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
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

  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
  const dataMin = amanha.toISOString().split('T')[0]

  const inputStyle = { position: 'relative' }
  const dropStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
    background: 'var(--branco)', border: '1.5px solid var(--bege-dark)',
    borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  }
  const dropItemStyle = (hover) => ({
    padding: '9px 14px', cursor: 'pointer', fontSize: 13,
    background: hover ? 'var(--bege)' : 'transparent',
    borderBottom: '1px solid var(--bege)',
  })

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
          {[['todas', 'Todas'], ['avista', '✅ À vista'], ['prazo', '⏳ A prazo'], ['pendente', '🔴 Pendentes']].map(([k, l]) => (
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
                      {v.clientes
                        ? <span style={{ fontWeight: 500 }}>👤 {v.clientes.nome}</span>
                        : (
                          <button
                            onClick={e => { e.stopPropagation(); setVendaVincular(v); setClienteVincular(null); setBuscaVincular(''); setModalVincular(true) }}
                            style={{ fontSize: 11, color: 'var(--dourado-dark)', background: '#F5EDD8', border: '1px solid var(--dourado)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            + vincular
                          </button>
                        )
                      }
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
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={e => { e.stopPropagation(); imprimirComprovante({ id: v.id, data: new Date(v.created_at).toLocaleString('pt-BR'), cliente: v.clientes, canal: v.canal, tipoPagamento: v.tipo_pagamento, dataVencimento: v.data_vencimento, itens: v.itens_venda?.map(i => ({ nome: i.produtos?.nome, quantidade: i.quantidade, preco_unitario: i.preco_unitario })) || [], subtotal: Number(v.total), descontoValor: 0, tipoDesconto: 'valor', descontoPercent: 0, total: Number(v.total), observacao: v.observacao }) }}>🧾</button>
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={e => { e.stopPropagation(); abrirEditar(v) }}>✏️</button>
                        <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={e => excluirVenda(v, e)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modal Nova / Editar Venda ─── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
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

              {/* Cliente ─ À vista (opcional) */}
              {tipoPagamento === 'avista' && (
                <div className="form-group">
                  {!mostrarCliente ? (
                    <button
                      onClick={() => setMostrarCliente(true)}
                      style={{ fontSize: 13, color: 'var(--dourado-dark)', background: '#F5EDD8', border: '1px dashed var(--dourado)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', width: '100%' }}
                    >
                      👤 Identificar cliente (opcional) — recomendado para oferecer desconto e fidelizar
                    </button>
                  ) : (
                    <div style={{ background: 'var(--bege)', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <label className="form-label" style={{ margin: 0 }}>👤 Cliente (opcional)</label>
                        <button onClick={() => { setMostrarCliente(false); limparCliente() }} style={{ background: 'none', fontSize: 12, color: 'var(--texto-leve)', cursor: 'pointer' }}>✕ remover</button>
                      </div>
                      <div style={inputStyle} ref={dropClienteRef}>
                        <input
                          className="form-input"
                          style={{ margin: 0 }}
                          placeholder="🔍 Buscar por nome ou telefone..."
                          value={buscaCliente}
                          onChange={e => { setBuscaCliente(e.target.value); setShowDropCliente(true); if (clienteSel && e.target.value !== clienteSel.nome) { setClienteSel(null); setClienteId('') } }}
                          onFocus={() => setShowDropCliente(true)}
                        />
                        {showDropCliente && buscaCliente.length > 0 && (
                          <div style={dropStyle}>
                            {clientesFiltrados.length === 0 ? (
                              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--texto-leve)' }}>Nenhum cliente encontrado</div>
                            ) : clientesFiltrados.map(c => (
                              <div key={c.id} style={dropItemStyle(false)} onMouseDown={() => selecionarClienteDrop(c)}>
                                <strong>{c.nome}</strong> <span style={{ color: 'var(--texto-leve)', fontSize: 11 }}>{c.telefone}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {clienteSel && (
                        <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 6, fontWeight: 600 }}>✅ {clienteSel.nome} selecionado</div>
                      )}
                      <button
                        onClick={() => { setModalNovoCliente(true); setFormCliente({ nome: buscaCliente, telefone: '' }) }}
                        style={{ marginTop: 8, fontSize: 12, color: 'var(--dourado-dark)', background: 'var(--branco)', border: '1px solid var(--dourado)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
                      >
                        + Cadastrar novo cliente
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Cliente ─ A prazo (obrigatório) */}
              {tipoPagamento === 'prazo' && (
                <div style={{ background: '#FFF8EC', border: '1.5px solid var(--dourado)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dourado-dark)', textTransform: 'uppercase' }}>📋 Informações do prazo</div>
                  <div className="grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Cliente *</label>
                      <div style={inputStyle} ref={dropClienteRef}>
                        <input
                          className="form-input"
                          style={{ margin: 0 }}
                          placeholder="🔍 Buscar cliente..."
                          value={buscaCliente}
                          onChange={e => { setBuscaCliente(e.target.value); setShowDropCliente(true); if (clienteSel && e.target.value !== clienteSel.nome) { setClienteSel(null); setClienteId('') } }}
                          onFocus={() => setShowDropCliente(true)}
                        />
                        {showDropCliente && buscaCliente.length > 0 && (
                          <div style={dropStyle}>
                            {clientesFiltrados.length === 0 ? (
                              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--texto-leve)' }}>Nenhum cliente encontrado</div>
                            ) : clientesFiltrados.map(c => (
                              <div key={c.id} style={dropItemStyle(false)} onMouseDown={() => selecionarClienteDrop(c)}>
                                <strong>{c.nome}</strong> <span style={{ color: 'var(--texto-leve)', fontSize: 11 }}>{c.telefone}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {clienteSel && <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>✅ {clienteSel.nome}</div>}
                      <button onClick={() => { setModalNovoCliente(true); setFormCliente({ nome: buscaCliente, telefone: '' }) }} style={{ marginTop: 6, fontSize: 11, color: 'var(--dourado-dark)', background: 'none', border: '1px solid var(--dourado)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                        + Novo cliente
                      </button>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Vencimento *</label>
                      <input className="form-input" type="date" min={dataMin} value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Adicionar item */}
              <div style={{ background: 'var(--bege)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--texto-leve)', textTransform: 'uppercase' }}>Adicionar item</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setModoBusca('lista'); setBuscaProduto(''); setProdutoSel(null); setPreco('') }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--bege-dark)', background: modoBusca === 'lista' ? 'var(--dourado)' : 'var(--branco)', color: modoBusca === 'lista' ? 'white' : 'var(--texto-leve)', cursor: 'pointer', fontWeight: 600 }}>☰ Lista</button>
                    <button onClick={() => { setModoBusca('busca'); setBuscaProduto(''); setProdutoSel(null); setPreco('') }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--bege-dark)', background: modoBusca === 'busca' ? 'var(--dourado)' : 'var(--branco)', color: modoBusca === 'busca' ? 'white' : 'var(--texto-leve)', cursor: 'pointer', fontWeight: 600 }}>🔍 Busca</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px auto', gap: 8, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Produto</label>
                    {modoBusca === 'lista' ? (
                      <select className="form-input" style={{ margin: 0 }} value={produtoSel?.id || ''} onChange={e => { const p = produtos.find(x => x.id === e.target.value); if (p) selecionarProdutoDrop(p) }}>
                        <option value="">Selecione...</option>
                        {produtos.map(p => <option key={p.id} value={p.id} disabled={p.estoque_atual === 0}>{p.nome} ({p.estoque_atual} em estoque)</option>)}
                      </select>
                    ) : (
                      <div style={inputStyle} ref={dropProdRef}>
                        <input
                          className="form-input"
                          style={{ margin: 0 }}
                          placeholder="Digite o nome do produto..."
                          value={buscaProduto}
                          onChange={e => { setBuscaProduto(e.target.value); setShowDropProd(true); setProdutoSel(null); setPreco('') }}
                          onFocus={() => setShowDropProd(true)}
                        />
                        {showDropProd && buscaProduto.length > 0 && (
                          <div style={dropStyle}>
                            {prodsFiltrados.length === 0 ? (
                              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--texto-leve)' }}>Nenhum produto encontrado</div>
                            ) : prodsFiltrados.map(p => (
                              <div key={p.id} style={{ ...dropItemStyle(false), opacity: p.estoque_atual === 0 ? 0.4 : 1 }} onMouseDown={() => p.estoque_atual > 0 && selecionarProdutoDrop(p)}>
                                <strong>{p.nome}</strong>
                                <span style={{ color: p.estoque_atual === 0 ? 'var(--danger)' : 'var(--texto-leve)', fontSize: 11, marginLeft: 6 }}>({p.estoque_atual} em estoque)</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {produtoSel && <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>✅ {produtoSel.nome}</div>}
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

                  {/* Desconto */}
                  <div style={{ background: 'var(--bege)', borderRadius: 8, padding: '10px 14px', marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-leve)', marginBottom: 8 }}>DESCONTO (opcional)</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setTipoDesconto('percent')} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: tipoDesconto === 'percent' ? 'var(--dourado)' : 'var(--branco)', color: tipoDesconto === 'percent' ? 'white' : 'var(--texto-leve)', border: '1px solid var(--bege-dark)', cursor: 'pointer' }}>%</button>
                        <button onClick={() => setTipoDesconto('valor')} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: tipoDesconto === 'valor' ? 'var(--dourado)' : 'var(--branco)', color: tipoDesconto === 'valor' ? 'white' : 'var(--texto-leve)', border: '1px solid var(--bege-dark)', cursor: 'pointer' }}>R$</button>
                      </div>
                      <input className="form-input" style={{ margin: 0, maxWidth: 120 }} type="number" min="0" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)} placeholder={tipoDesconto === 'percent' ? 'Ex: 10' : 'Ex: 5,00'} />
                      {descontoValor > 0 && (
                        <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>− {fmt(descontoValor)}</span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div style={{ marginTop: 8, padding: '12px 14px', background: tipoPagamento === 'prazo' ? '#FFF8EC' : '#F5EDD8', borderRadius: 8 }}>
                    {descontoValor > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--texto-leve)', marginBottom: 4 }}>
                        <span>Subtotal</span><span>{fmt(subtotal)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{tipoPagamento === 'prazo' ? '📋 Total a prazo' : 'Total'}</span>
                      <span style={{ fontWeight: 700, fontSize: 20, fontFamily: 'Cormorant Garamond, serif', color: tipoPagamento === 'prazo' ? 'var(--warning)' : 'var(--dourado-dark)' }}>{fmt(totalCarrinho)}</span>
                    </div>
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

      {/* ─── Modal Cadastro Rápido de Cliente ─── */}
      {modalNovoCliente && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setModalNovoCliente(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 20 }}>👤 Novo Cliente</h3>
              <button onClick={() => setModalNovoCliente(false)} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bege)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--texto-leve)', marginBottom: 12 }}>
                💡 Cadastre o cliente para fidelizá-lo. O desconto é uma boa estratégia na primeira compra!
              </div>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-input" value={formCliente.nome} onChange={e => setFormCliente(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp *</label>
                <input className="form-input" value={formCliente.telefone} onChange={e => setFormCliente(f => ({ ...f, telefone: e.target.value }))} placeholder="(44) 99999-9999" inputMode="numeric" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalNovoCliente(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarNovoCliente} disabled={salvandoCliente}>
                {salvandoCliente ? 'Cadastrando...' : 'Cadastrar e Selecionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Vincular Cliente ─── */}
      {modalVincular && (
        <div className="modal-overlay" onClick={() => setModalVincular(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 20 }}>👤 Vincular Cliente à Venda</h3>
              <button onClick={() => setModalVincular(false)} style={{ background: 'none', fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--texto-leve)', marginBottom: 12 }}>
                Venda de {vendaVincular?.itens_venda?.map(i => i.produtos?.nome).join(', ')} · {fmt(vendaVincular?.total)}
              </div>
              <input
                className="form-input"
                placeholder="🔍 Buscar cliente..."
                value={buscaVincular}
                onChange={e => setBuscaVincular(e.target.value)}
              />
              <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                {clientes.filter(c => c.nome.toLowerCase().includes(buscaVincular.toLowerCase()) || (c.telefone || '').includes(buscaVincular)).map(c => (
                  <div key={c.id} onClick={() => setClienteVincular(c)} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: clienteVincular?.id === c.id ? 'var(--bege-dark)' : 'transparent', border: '1px solid', borderColor: clienteVincular?.id === c.id ? 'var(--dourado)' : 'transparent', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>{c.telefone}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalVincular(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarVincularCliente} disabled={!clienteVincular}>Vincular</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Comprovante ─── */}
      {comprovante && (
        <div className="modal-overlay" onClick={() => setComprovante(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 20 }}>🧾 Comprovante</h3>
              <button onClick={() => setComprovante(null)} style={{ background: 'none', fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 700, color: 'var(--dourado-dark)' }}>Terra de Maria</div>
                <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>Artigos Religiosos · Marilândia do Sul / PR</div>
              </div>
              <div style={{ borderTop: '1px dashed var(--bege-dark)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--texto-leve)' }}>Data</span><span>{comprovante.data}</span></div>
                {comprovante.cliente && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--texto-leve)' }}>Cliente</span><span>{comprovante.cliente.nome}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--texto-leve)' }}>Canal</span><span>{canalLabel[comprovante.canal]}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: 'var(--texto-leve)' }}>Pagamento</span><span>{comprovante.tipoPagamento === 'avista' ? 'À vista' : 'A prazo'}</span></div>
              </div>
              <div style={{ borderTop: '1px dashed var(--bege-dark)', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {comprovante.itens.map((i, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{i.quantidade}x {i.nome}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(i.quantidade * i.preco_unitario)}</span>
                  </div>
                ))}
              </div>
              {comprovante.descontoValor > 0 && (
                <div style={{ borderTop: '1px dashed var(--bege-dark)', padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--texto-leve)' }}><span>Subtotal</span><span>{fmt(comprovante.subtotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)' }}><span>Desconto</span><span>− {fmt(comprovante.descontoValor)}</span></div>
                </div>
              )}
              <div style={{ borderTop: '2px solid var(--bege-dark)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>TOTAL</span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 700, color: 'var(--dourado-dark)' }}>{fmt(comprovante.total)}</span>
              </div>
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--texto-leve)' }}>
                Obrigada pela preferência! 🙏<br />Que Nossa Senhora abençoe você.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setComprovante(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => imprimirComprovante(comprovante)}>🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detalhe ─── */}
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
