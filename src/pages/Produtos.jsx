import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CATEGORIAS = ['terço', 'escapulário', 'pulseira', 'chaveiro', 'medalhão', 'kit', 'outros']

const emptyForm = {
  nome: '', categoria: 'terço', custo: '', preco_venda: '', estoque_atual: '', estoque_minimo: '5'
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [msg, setMsg] = useState(null)

  useEffect(() => { loadProdutos() }, [])

  async function loadProdutos() {
    setLoading(true)
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    setProdutos(data || [])
    setLoading(false)
  }

  function abrirModal(produto = null) {
    if (produto) {
      setEditando(produto.id)
      setForm({
        nome: produto.nome,
        categoria: produto.categoria,
        custo: produto.custo,
        preco_venda: produto.preco_venda,
        estoque_atual: produto.estoque_atual,
        estoque_minimo: produto.estoque_minimo,
      })
    } else {
      setEditando(null)
      setForm(emptyForm)
    }
    setModal(true)
  }

  function fecharModal() {
    setModal(false)
    setEditando(null)
    setForm(emptyForm)
  }

  async function salvar() {
    if (!form.nome.trim()) return showMsg('Informe o nome do produto', 'danger')
    if (!form.preco_venda) return showMsg('Informe o preço de venda', 'danger')

    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria,
      custo: Number(form.custo) || 0,
      preco_venda: Number(form.preco_venda),
      estoque_atual: Number(form.estoque_atual) || 0,
      estoque_minimo: Number(form.estoque_minimo) || 5,
    }

    let error
    if (editando) {
      ;({ error } = await supabase.from('produtos').update(payload).eq('id', editando))
    } else {
      ;({ error } = await supabase.from('produtos').insert(payload))
    }

    if (error) {
      showMsg('Erro ao salvar: ' + error.message, 'danger')
    } else {
      showMsg(editando ? 'Produto atualizado!' : 'Produto cadastrado!', 'success')
      fecharModal()
      loadProdutos()
    }
    setSalvando(false)
  }

  async function arquivar(id) {
    if (!confirm('Arquivar este produto?')) return
    await supabase.from('produtos').update({ ativo: false }).eq('id', id)
    loadProdutos()
  }

  function showMsg(text, type = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const margem = (c, v) => v > 0 ? (((v - c) / v) * 100).toFixed(0) + '%' : '—'

  const filtrados = produtos.filter(p => {
    const okBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
    const okCat = catFiltro === 'todas' || p.categoria === catFiltro
    return okBusca && okCat
  })

  const estoqueStatus = (p) => {
    if (p.estoque_atual === 0) return { label: 'Zerado', cls: 'badge-danger' }
    if (p.estoque_atual <= p.estoque_minimo) return { label: 'Baixo', cls: 'badge-warning' }
    return { label: 'OK', cls: 'badge-success' }
  }

  return (
    <div>
      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      <div className="page-header">
        <div>
          <h2 className="page-title">Produtos</h2>
          <p className="page-subtitle">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          + Novo Produto
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ maxWidth: 220, margin: 0 }}
            placeholder="🔍  Buscar produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['todas', ...CATEGORIAS].map(c => (
              <button
                key={c}
                onClick={() => setCatFiltro(c)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: catFiltro === c ? 'var(--dourado)' : 'var(--bege)',
                  color: catFiltro === c ? 'white' : 'var(--texto-leve)',
                  border: 'none',
                  textTransform: 'capitalize',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <p style={{ color: 'var(--texto-leve)', padding: 24 }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📿</div>
          <h3>Nenhum produto encontrado</h3>
          <p>Cadastre seu primeiro produto clicando em "+ Novo Produto"</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Custo</th>
                <th>Preço Venda</th>
                <th>Margem</th>
                <th>Estoque</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const st = estoqueStatus(p)
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nome}</td>
                    <td>
                      <span className="badge badge-nude" style={{ textTransform: 'capitalize' }}>
                        {p.categoria}
                      </span>
                    </td>
                    <td style={{ color: 'var(--texto-leve)' }}>{fmt(p.custo)}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(p.preco_venda)}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: Number(p.preco_venda) > Number(p.custo) ? 'var(--success)' : 'var(--danger)',
                        fontSize: 13,
                      }}>
                        {margem(p.custo, p.preco_venda)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{p.estoque_atual}</span>
                      <span style={{ color: 'var(--texto-leve)', fontSize: 11 }}> / mín {p.estoque_minimo}</span>
                    </td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => abrirModal(p)}>
                          Editar
                        </button>
                        <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => arquivar(p.id)}>
                          Arquivar
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

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>{editando ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={fecharModal} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome do Produto *</label>
                <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Terço de Nossa Senhora" />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Custo (R$)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Preço de Venda (R$) *</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.preco_venda} onChange={e => setForm(f => ({ ...f, preco_venda: e.target.value }))} placeholder="0,00" />
                </div>
              </div>
              {form.custo && form.preco_venda && (
                <div style={{ background: 'var(--bege)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  💡 Margem: <strong style={{ color: 'var(--success)' }}>{margem(form.custo, form.preco_venda)}</strong>
                  {' · '}Lucro por unidade: <strong>{fmt(Number(form.preco_venda) - Number(form.custo))}</strong>
                </div>
              )}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Estoque Atual</label>
                  <input className="form-input" type="number" min="0" value={form.estoque_atual} onChange={e => setForm(f => ({ ...f, estoque_atual: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Estoque Mínimo</label>
                  <input className="form-input" type="number" min="0" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} placeholder="5" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : editando ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
