import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

function StatCard({ icon, label, value, sub, color = 'var(--dourado)' }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--texto-leve)', fontWeight: 500 }}>{label}</span>
        <span style={{
          background: `${color}18`,
          borderRadius: 8,
          padding: '6px 8px',
          fontSize: 18,
        }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontFamily: 'Cormorant Garamond, serif', fontWeight: 700, color }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    vendasMes: 0,
    lucroMes: 0,
    saldo: 0,
    totalProdutos: 0,
  })
  const [estoqueBaixo, setEstoqueBaixo] = useState([])
  const [vendasRecentes, setVendasRecentes] = useState([])
  const [topProdutos, setTopProdutos] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      // Vendas do mês
      const { data: vendasMesData } = await supabase
        .from('vendas')
        .select('total, created_at')
        .gte('created_at', inicioMes.toISOString())

      const totalVendasMes = vendasMesData?.reduce((s, v) => s + Number(v.total), 0) || 0

      // Saldo financeiro
      const { data: finData } = await supabase.from('financeiro').select('tipo, valor')
      const saldo = finData?.reduce((s, f) => f.tipo === 'entrada' ? s + Number(f.valor) : s - Number(f.valor), 0) || 0

      // Total produtos ativos
      const { count: totalProdutos } = await supabase
        .from('produtos').select('id', { count: 'exact' }).eq('ativo', true)

      // Estoque baixo
      const { data: produtosData } = await supabase
        .from('produtos').select('*').eq('ativo', true)

      const baixo = produtosData?.filter(p => p.estoque_atual <= p.estoque_minimo) || []
      setEstoqueBaixo(baixo)

      // Lucro do mês (itens vendidos no mês)
      const { data: itensVendasMes } = await supabase
        .from('itens_venda')
        .select('quantidade, preco_unitario, produto_id, vendas(created_at), produtos(custo)')
        .gte('vendas.created_at', inicioMes.toISOString())

      const lucroMes = itensVendasMes?.reduce((s, i) => {
        if (!i.vendas) return s
        const receita = Number(i.preco_unitario) * i.quantidade
        const custo = Number(i.produtos?.custo || 0) * i.quantidade
        return s + (receita - custo)
      }, 0) || 0

      setStats({ vendasMes: totalVendasMes, lucroMes, saldo, totalProdutos: totalProdutos || 0 })

      // Vendas recentes
      const { data: recentes } = await supabase
        .from('vendas')
        .select('id, total, canal, created_at, itens_venda(quantidade, produto_id, produtos(nome))')
        .order('created_at', { ascending: false })
        .limit(8)
      setVendasRecentes(recentes || [])

      // Top produtos (últimos 30 dias)
      const inicio30 = new Date()
      inicio30.setDate(inicio30.getDate() - 30)
      const { data: itens30 } = await supabase
        .from('itens_venda')
        .select('quantidade, preco_unitario, produto_id, produtos(nome), vendas(created_at)')
        .gte('vendas.created_at', inicio30.toISOString())

      const agrupado = {}
      itens30?.forEach(i => {
        if (!i.vendas || !i.produtos) return
        const nome = i.produtos.nome
        if (!agrupado[nome]) agrupado[nome] = { nome, quantidade: 0, total: 0 }
        agrupado[nome].quantidade += i.quantidade
        agrupado[nome].total += Number(i.preco_unitario) * i.quantidade
      })
      const top = Object.values(agrupado).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5)
      setTopProdutos(top)

      // Chart: últimos 7 dias
      const dias = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const fim = new Date(d)
        fim.setHours(23, 59, 59)
        const total = vendasMesData?.filter(v => {
          const vd = new Date(v.created_at)
          return vd >= d && vd <= fim
        }).reduce((s, v) => s + Number(v.total), 0) || 0
        dias.push({
          dia: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
          vendas: total,
        })
      }
      setChartData(dias)

    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const canalLabel = { whatsapp: 'WhatsApp', presencial: 'Presencial', feira: 'Feira' }
  const canalColor = { whatsapp: 'badge-verde', presencial: 'badge-dourado', feira: 'badge-nude' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--bege-dark)', borderTop: '3px solid var(--dourado)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--texto-leve)', fontSize: 13 }}>Carregando...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div>
      {/* Alertas de estoque baixo */}
      {estoqueBaixo.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <strong>{estoqueBaixo.length} produto(s) com estoque baixo: </strong>
            {estoqueBaixo.map(p => (
              <span key={p.id} style={{ marginRight: 12 }}>
                {p.nome} <span style={{ fontWeight: 700 }}>({p.estoque_atual})</span>
              </span>
            ))}
            <Link to="/estoque" style={{ color: 'var(--warning)', fontWeight: 600, marginLeft: 4 }}>Ver estoque →</Link>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="💰" label="Vendas do mês" value={fmt(stats.vendasMes)} sub="receita total" color="var(--dourado)" />
        <StatCard icon="📈" label="Lucro estimado" value={fmt(stats.lucroMes)} sub="receita − custo" color="var(--success)" />
        <StatCard icon="🏦" label="Saldo financeiro" value={fmt(stats.saldo)} sub="todas entradas/saídas" color={stats.saldo >= 0 ? 'var(--success)' : 'var(--danger)'} />
        <StatCard icon="📿" label="Produtos ativos" value={stats.totalProdutos} sub={`${estoqueBaixo.length} com estoque baixo`} color="var(--verde)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Gráfico de vendas */}
        <div className="card">
          <h3 style={{ fontSize: 20, marginBottom: 16 }}>Vendas — últimos 7 dias</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bege-dark)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--texto-leve)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--texto-leve)' }} tickFormatter={v => `R$${v}`} />
              <Tooltip
                formatter={(v) => [`R$ ${v.toFixed(2)}`, 'Vendas']}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--bege-dark)', fontSize: 13 }}
              />
              <Bar dataKey="vendas" fill="var(--dourado)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top produtos */}
        <div className="card">
          <h3 style={{ fontSize: 20, marginBottom: 16 }}>Top produtos (30 dias)</h3>
          {topProdutos.length === 0 ? (
            <p style={{ color: 'var(--texto-leve)', fontSize: 13 }}>Nenhuma venda registrada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topProdutos.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: i === 0 ? 'var(--dourado)' : 'var(--bege-dark)',
                    color: i === 0 ? 'white' : 'var(--texto-leve)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--texto-leve)' }}>{p.quantidade} un · {fmt(p.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vendas recentes */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 20 }}>Vendas recentes</h3>
          <Link to="/vendas" style={{ fontSize: 13, color: 'var(--dourado)', fontWeight: 600, textDecoration: 'none' }}>
            Ver todas →
          </Link>
        </div>
        {vendasRecentes.length === 0 ? (
          <p style={{ color: 'var(--texto-leve)', fontSize: 13 }}>Nenhuma venda registrada ainda.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produtos</th>
                  <th>Canal</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {vendasRecentes.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontSize: 13, color: 'var(--texto-leve)', whiteSpace: 'nowrap' }}>
                      {new Date(v.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {v.itens_venda?.slice(0, 2).map(i => i.produtos?.nome).filter(Boolean).join(', ')}
                      {v.itens_venda?.length > 2 && ` +${v.itens_venda.length - 2}`}
                    </td>
                    <td>
                      <span className={`badge ${canalColor[v.canal] || 'badge-nude'}`}>
                        {canalLabel[v.canal] || v.canal}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--dourado-dark)' }}>{fmt(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
