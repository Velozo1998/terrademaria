import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Produtos from './pages/Produtos'
import Vendas from './pages/Vendas'
import Compras from './pages/Compras'
import Estoque from './pages/Estoque'
import Financeiro from './pages/Financeiro'
import Clientes from './pages/Clientes'
import Cobranças from './pages/Cobranças'

export default function App() {
  return (
    <BrowserRouter basename="/terrademaria">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="vendas" element={<Vendas />} />
          <Route path="compras" element={<Compras />} />
          <Route path="estoque" element={<Estoque />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="cobranças" element={<Cobranças />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
