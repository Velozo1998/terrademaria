-- =============================================
-- TERRA DE MARIA — Atualizações do Banco
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. TABELA DE CLIENTES (nova)
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  endereco TEXT,
  cpf TEXT,
  data_nascimento DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON clientes FOR ALL USING (true) WITH CHECK (true);

-- 2. COLUNAS DE PRAZO NA TABELA VENDAS (adicionar nas existentes)
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT DEFAULT 'avista';
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pago';
-- tipo_pagamento: 'avista' | 'prazo'
-- status_pagamento: 'pago' | 'pendente' | 'vencido'
