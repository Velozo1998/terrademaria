import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Cobranças() {
  const [cobranças, setCobranças] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { loadCobranças() }, [])

  async function loadCobranças() {
    setLoading(true)
    const hoje = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('vendas')
      .select('*, itens_venda(quantidade, preco_unitario, produto_id, produtos(nome)), clientes(nome, telefone)')
      .eq('tipo_pagamento', 'prazo')
      .neq('status_pagamento', 'pago')
      .order('data_vencimento', { ascending: true })

    if (data) {
      // Atualiza vencidos automaticamente
      for (const v of data) {
        if (v.data_vencimento < hoje && v.status_pagamento !== 'vencido') {
          await supabase.from('vendas').update({ status_pagamento: 'vencido' }).eq('id', v.id)
          v.status_pagamento = 'vencido'
        }
      }
      setCobranças(data)
    }
    setLoading(false)
  }

  async function marcarPago(venda) {
    if (!confirm(`Marcar como pago R$ ${Number(venda.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de ${venda.clientes?.nome}?`)) return

    try {
      // Atualiza status da venda
      await supabase.from('vendas').update({ status_pagamento: 'pago' }).eq('id', venda.id)

      // Lança no financeiro
      await supabase.from('financeiro').insert({
        tipo: 'entrada',
        categoria: 'venda',
        descricao: `Recebimento de ${venda.clientes?.nome} — ${venda.itens_venda?.map(i => i.produtos?.nome).join(', ')}`,
        valor: venda.total,
        referencia_id: venda.id,
      })

      showMsg(`Pagamento de ${venda.clientes?.nome} registrado! 💰`, 'success')
      loadCobranças()
    } catch (e) {
      showMsg('Erro: ' + e.message, 'danger')
    }
  }

  function showMsg(text, type = 'success') { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000) }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const hoje = new Date().toISOString().split('T')[0]
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = amanha.toISOString().split('T')[0]

  const statusInfo = (v) => {
    if (v.status_pagamento === 'vencido' || v.data_vencimento < hoje) {
      const dias = Math.floor((new Date(hoje) - new Date(v.data_vencimento)) / (1000 * 60 * 60 * 24))
      return { label: `🔴 Vencido há ${dias}d`, cls: 'badge-danger', cor: '#FDF2F2' }
    }
    if (v.data_vencimento === hoje) return { label: '🟡 Vence hoje!', cls: 'badge-warning', cor: '#FFFBEC' }
    if (v.data_vencimento === amanhaStr) return { label: '🟠 Vence amanhã', cls: 'badge-warning', cor: '#FFFBEC' }
    const dias = Math.floor((new Date(v.data_vencimento) - new Date(hoje)) / (1000 * 60 * 60 * 24))
    return { label: `⏳ ${dias} dias`, cls: 'badge-nude', cor: undefined }
  }

  const vencidos = cobranças.filter(v => v.data_vencimento < hoje || v.status_pagamento === 'vencido')
  const hoje_ = cobranças.filter(v => v.data_vencimento === hoje)
  const futuros = cobranças.filter(v => v.data_vencimento > hoje && v.status_pagamento !== 'vencido')
  const totalPendente = cobranças.reduce((s, v) => s + Number(v.total), 0)
  const totalVencido = vencidos.reduce((s, v) => s + Number(v.total), 0)

  const filtradas = cobranças.filter(v => {
    if (filtro === 'vencidos') return v.data_vencimento < hoje || v.status_pagamento === 'vencido'
    if (filtro === 'hoje') return v.data_vencimento === hoje
    if (filtro === 'futuros') return v.data_vencimento > hoje && v.status_pagamento !== 'vencido'
    return true
  })

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="page-header">
        <div>
          <h2 className="page-title">Cobranças</h2>
          <p className="page-subtitle">{cobranças.length} pendente(s) · {fmt(totalPendente)} a receber</p>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 4 }}>🔴 Vencidos</div>
          <div style={{ fontSize: 24, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color: 'var(--danger)' }}>{fmt(totalVencido)}</div>
          <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>{vencidos.length} cobrança(s)</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--warning)', padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 4 }}>🟡 Vencem hoje</div>
          <div style={{ fontSize: 24, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color: 'var(--warning)' }}>{fmt(hoje_.reduce((s, v) => s + Number(v.total), 0))}</div>
          <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>{hoje_.length} cobrança(s)</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--success)', padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 4 }}>⏳ A vencer</div>
          <div style={{ fontSize: 24, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color: 'var(--success)' }}>{fmt(futuros.reduce((s, v) => s + Number(v.total), 0))}</div>
          <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>{futuros.length} cobrança(s)</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['todos','Todos'],['vencidos','🔴 Vencidos'],['hoje','🟡 Hoje'],['futuros','⏳ A vencer']].map(([k,l]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: filtro === k ? 'var(--dourado)' : 'var(--bege)',
              color: filtro === k ? 'white' : 'var(--texto-leve)', border: 'none',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--texto-leve)' }}>Carregando...</p> : filtradas.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">🎉</div>
          <h3>Nenhuma cobrança pendente</h3>
          <p>Todas as vendas a prazo foram pagas!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(v => {
            const st = statusInfo(v)
            return (
              <div key={v.id} className="card" style={{ background: st.cor || 'var(--branco)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    {/* Cliente */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>👤</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Cormorant Garamond, serif' }}>{v.clientes?.nome || '—'}</div>
                        {v.clientes?.telefone && (
                          <a
                            href={`https://wa.me/55${v.clientes.telefone.replace(/\D/g, '')}?text=Olá ${v.clientes.nome}! Passando para lembrar do pagamento de ${fmt(v.total)} referente aos produtos da Terra de Maria. 🙏`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, color: 'var(--verde)', fontWeight: 600, textDecoration: 'none' }}
                          >
                            💬 Cobrar no WhatsApp — {v.clientes.telefone}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Produtos */}
                    <div style={{ fontSize: 12, color: 'var(--texto-leve)', marginBottom: 6 }}>
                      {v.itens_venda?.map(i => `${i.quantidade}x ${i.produtos?.nome}`).join(' · ')}
                    </div>

                    {/* Datas e status */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--texto-leve)' }}>
                        Vencimento: {new Date(v.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--texto-leve)' }}>
                        Venda em: {new Date(v.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {v.observacao && <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--texto-leve)' }}>"{v.observacao}"</span>}
                    </div>
                  </div>

                  {/* Valor + botão */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>
                      {fmt(v.total)}
                    </div>
                    <button
                      className="btn btn-success"
                      style={{ padding: '8px 16px', fontSize: 13, background: 'var(--success)', color: 'white' }}
                      onClick={() => marcarPago(v)}
                    >
                      ✅ Marcar como pago
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
