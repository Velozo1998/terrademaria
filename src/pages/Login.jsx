import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  async function entrar(e) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('E-mail ou senha incorretos.')
    }
    setCarregando(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bege)', fontFamily: 'Montserrat, sans-serif',
    }}>
      <div style={{
        background: 'var(--branco)', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 380, boxShadow: '0 4px 32px rgba(0,0,0,0.07)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Cormorant Garamond, serif', fontSize: 28,
            fontWeight: 700, color: 'var(--dourado-dark)', marginBottom: 4,
          }}>
            Terra de Maria
          </div>
          <div style={{ fontSize: 12, color: 'var(--texto-leve)', letterSpacing: '0.08em' }}>
            SISTEMA DE GESTÃO
          </div>
        </div>

        {erro && (
          <div className="alert alert-danger" style={{ marginBottom: 20, fontSize: 13 }}>
            {erro}
          </div>
        )}

        <form onSubmit={entrar}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              className="form-input"
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8 }}
            disabled={carregando}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--texto-leve)', textAlign: 'center' }}>
          Esqueceu a senha? Fale com o administrador.
        </div>
      </div>
    </div>
  )
}
