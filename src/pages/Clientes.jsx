import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { registrarLog } from '../logger'

const emptyForm = {
  nome: '', telefone: '', endereco: '', cpf: '', data_nascimento: '', observacao: ''
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState(null)

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nome')
    setClientes(data || [])
    setLoading(false)
  }

  function abrirModal(cliente = null) {
    if (cliente) {
      setEditando(cliente.id)
      setForm({
        nome: cliente.nome || '',
        telefone: cliente.telefone || '',
        endereco: cliente.endereco || '',
        cpf: cliente.cpf || '',
        data_nascimento: cliente.data_nascimento || '',
        observacao: cliente.observacao || '',
      })
    } else {
      setEditando(null)
      setForm(emptyForm)
    }
    setModal(true)
  }

  function fecharModal() { setModal(false); setEditando(null); setForm(emptyForm) }

  function formatarTelefone(v) {
    const nums = v.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 2) return nums
    if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`
    if (nums.length <= 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`
    return v
  }

  function formatarCPF(v) {
    const nums = v.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 3) return nums
    if (nums.length <= 6) return `${nums.slice(0,3)}.${nums.slice(3)}`
    if (nums.length <= 9) return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6)}`
    return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`
  }

  async function salvar() {
    if (!form.nome.trim()) return showMsg('Nome é obrigatório', 'danger')
    if (!form.telefone.trim()) return showMsg('Telefone é obrigatório', 'danger')

    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      endereco: form.endereco.trim() || null,
      cpf: form.cpf.trim() || null,
      data_nascimento: form.data_nascimento || null,
      observacao: form.observacao.trim() || null,
    }

    let error
    if (editando) {
      ;({ error } = await supabase.from('clientes').update(payload).eq('id', editando))
    } else {
      ;({ error } = await supabase.from('clientes').insert(payload))
    }

    if (error) { showMsg('Erro: ' + error.message, 'danger') }
    else {
      await registrarLog({ acao: editando ? 'editou' : 'cadastrou', modulo: 'clientes', descricao: `${editando ? 'Editou' : 'Cadastrou'} cliente "${payload.nome}" · ${payload.telefone}` })
      showMsg(editando ? 'Cliente atualizado!' : 'Cliente cadastrado!', 'success'); fecharModal(); loadClientes()
    }
    setSalvando(false)
  }

  async function excluir(id) {
    if (!confirm('Excluir este cliente permanentemente?')) return
    const cli = clientes.find(c => c.id === id)
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) { showMsg('Erro ao excluir: ' + error.message, 'danger') }
    else {
      await registrarLog({ acao: 'excluiu', modulo: 'clientes', descricao: `Excluiu cliente "${cli?.nome}"` })
      showMsg('Cliente excluído.', 'success'); loadClientes()
    }
  }

  function showMsg(text, type = 'success') { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000) }

  const aniversarioHoje = (data) => {
    if (!data) return false
    const hoje = new Date()
    const nasc = new Date(data + 'T12:00:00')
    return nasc.getDate() === hoje.getDate() && nasc.getMonth() === hoje.getMonth()
  }

  const calcularIdade = (data) => {
    if (!data) return null
    const hoje = new Date()
    const nasc = new Date(data + 'T12:00:00')
    let idade = hoje.getFullYear() - nasc.getFullYear()
    if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  )

  // Aniversariantes do mês
  const anivMes = clientes.filter(c => {
    if (!c.data_nascimento) return false
    return new Date(c.data_nascimento + 'T12:00:00').getMonth() === new Date().getMonth()
  })

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Clientes</h2>
          <p className="page-subtitle">{clientes.length} cliente(s) cadastrado(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>+ Novo Cliente</button>
      </div>

      {/* Aniversariantes do mês */}
      {anivMes.length > 0 && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          🎂 <strong>Aniversariantes deste mês:</strong>{' '}
          {anivMes.map(c => (
            <span key={c.id} style={{ marginRight: 12 }}>
              {aniversarioHoje(c.data_nascimento) ? '🎉 ' : ''}{c.nome}
              {c.data_nascimento && ` (${new Date(c.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`}
            </span>
          ))}
        </div>
      )}

      {/* Busca */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <input
          className="form-input"
          style={{ maxWidth: 320, margin: 0 }}
          placeholder="🔍  Buscar por nome ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">👥</div>
          <h3>Nenhum cliente encontrado</h3>
          <p>Cadastre seu primeiro cliente clicando em "+ Novo Cliente"</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Endereço</th>
                <th>CPF</th>
                <th>Nascimento</th>
                <th>Obs.</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(c)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {aniversarioHoje(c.data_nascimento) && <span title="Aniversário hoje!">🎂 </span>}
                      {c.nome}
                    </div>
                  </td>
                  <td>
                    <a
                      href={`https://wa.me/55${c.telefone?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: 'var(--verde)', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}
                    >
                      💬 {c.telefone}
                    </a>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)' }}>{c.endereco || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)' }}>{c.cpf || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)', whiteSpace: 'nowrap' }}>
                    {c.data_nascimento
                      ? `${new Date(c.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')} (${calcularIdade(c.data_nascimento)} anos)`
                      : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--texto-leve)', maxWidth: 160 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.observacao || '—'}
                    </div>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => abrirModal(c)}>✏️ Editar</button>
                      <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => excluir(c.id)}>🗑️ Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Cadastro / Edição */}
      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>{editando ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={fecharModal} style={{ background: 'none', fontSize: 20, color: 'var(--texto-leve)' }}>✕</button>
            </div>
            <div className="modal-body">
              {/* Obrigatórios */}
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp *</label>
                <input
                  className="form-input"
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: formatarTelefone(e.target.value) }))}
                  placeholder="(44) 99999-9999"
                  inputMode="numeric"
                />
              </div>

              {/* Opcionais */}
              <div style={{ borderTop: '1px dashed var(--bege-dark)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--texto-leve)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12, letterSpacing: '0.5px' }}>
                  Informações opcionais
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço</label>
                  <input className="form-input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">CPF</label>
                    <input
                      className="form-input"
                      value={form.cpf}
                      onChange={e => setForm(f => ({ ...f, cpf: formatarCPF(e.target.value) }))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data de Nascimento</label>
                    <input className="form-input" type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observação</label>
                  <input className="form-input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: prefere terços coloridos, cliente fiel..." />
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

      {/* Detalhe cliente */}
      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 22 }}>
                {aniversarioHoje(detalhe.data_nascimento) ? '🎂 ' : '👤 '}{detalhe.nome}
              </h3>
              <button onClick={() => setDetalhe(null)} style={{ background: 'none', fontSize: 20 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>💬</span>
                  <a href={`https://wa.me/55${detalhe.telefone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--verde)', fontWeight: 600 }}>
                    {detalhe.telefone}
                  </a>
                </div>
                {detalhe.endereco && <div style={{ display: 'flex', gap: 8 }}><span>📍</span><span>{detalhe.endereco}</span></div>}
                {detalhe.cpf && <div style={{ display: 'flex', gap: 8 }}><span>🪪</span><span>{detalhe.cpf}</span></div>}
                {detalhe.data_nascimento && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span>🎂</span>
                    <span>
                      {new Date(detalhe.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {' · '}{calcularIdade(detalhe.data_nascimento)} anos
                      {aniversarioHoje(detalhe.data_nascimento) && <span style={{ marginLeft: 8, color: 'var(--success)', fontWeight: 700 }}>🎉 Hoje!</span>}
                    </span>
                  </div>
                )}
                {detalhe.observacao && (
                  <div style={{ background: 'var(--bege)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    📝 {detalhe.observacao}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalhe(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => { setDetalhe(null); abrirModal(detalhe) }}>✏️ Editar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
