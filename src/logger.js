import { supabase } from './supabase'

export async function registrarLog({ acao, modulo, descricao, referencia_id }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('logs').insert({
      user_id: user.id,
      user_email: user.email,
      acao,
      modulo,
      descricao,
      referencia_id: referencia_id || null,
    })
  } catch (e) {
    console.error('Erro ao registrar log:', e)
  }
}
