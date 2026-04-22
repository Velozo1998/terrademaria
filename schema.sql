-- =============================================
-- TERRA DE MARIA — Schema do Banco de Dados
-- Execute no Supabase SQL Editor
-- =============================================

-- PRODUTOS
CREATE TABLE produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outros',
  custo NUMERIC(10,2) DEFAULT 0,
  preco_venda NUMERIC(10,2) DEFAULT 0,
  estoque_atual INTEGER DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 5,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENDAS
CREATE TABLE vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canal TEXT DEFAULT 'whatsapp',
  total NUMERIC(10,2) DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ITENS DA VENDA
CREATE TABLE itens_venda (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  quantidade INTEGER NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL
);

-- COMPRAS
CREATE TABLE compras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT,
  total NUMERIC(10,2) DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ITENS DA COMPRA
CREATE TABLE itens_compra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id UUID REFERENCES compras(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  quantidade INTEGER NOT NULL,
  custo_unitario NUMERIC(10,2) NOT NULL
);

-- FINANCEIRO (lançamentos manuais + automáticos)
CREATE TABLE financeiro (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL, -- 'entrada' ou 'saida'
  categoria TEXT NOT NULL, -- 'venda', 'compra', 'despesa', 'outra'
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  referencia_id UUID, -- venda_id ou compra_id se automático
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MOVIMENTAÇÕES DE ESTOQUE (log completo)
CREATE TABLE movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID REFERENCES produtos(id),
  tipo TEXT NOT NULL, -- 'entrada' ou 'saida'
  motivo TEXT NOT NULL, -- 'venda', 'compra', 'ajuste', 'perda', 'brinde'
  quantidade INTEGER NOT NULL,
  referencia_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;

-- Permite tudo para anon (sem autenticação por ora)
CREATE POLICY "allow_all" ON produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON itens_venda FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON compras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON itens_compra FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON financeiro FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON movimentacoes FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- DADOS DE EXEMPLO (opcional, pode apagar)
-- =============================================
INSERT INTO produtos (nome, categoria, custo, preco_venda, estoque_atual, estoque_minimo) VALUES
  ('Terço de Nossa Senhora', 'terço', 8.00, 25.00, 15, 5),
  ('Escapulário do Carmo', 'escapulário', 4.00, 15.00, 20, 5),
  ('Pulseira Mariana', 'pulseira', 6.00, 20.00, 10, 3),
  ('Chaveiro Cruz Dourada', 'chaveiro', 3.00, 12.00, 8, 5);
