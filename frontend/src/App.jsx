import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Terceros from './pages/Terceros';
import Productos from './pages/Productos';
import Compras from './pages/Compras';
import Cuarentena from './pages/Cuarentena';
import Cotizaciones from './pages/Cotizaciones';
import Pedidos from './pages/Pedidos';
import Picking from './pages/Picking';
import Facturas from './pages/Facturas';
import Auditoria from './pages/Auditoria';
import Usuarios from './pages/Usuarios';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/terceros" element={<ProtectedRoute roles={['CONTABILIDAD', 'COMPRAS', 'COMERCIAL', 'CARTERA']}><Terceros /></ProtectedRoute>} />
      <Route path="/productos" element={<ProtectedRoute roles={['COMPRAS', 'CONTABILIDAD', 'VENDEDOR', 'BODEGUERO']}><Productos /></ProtectedRoute>} />
      <Route path="/compras" element={<ProtectedRoute roles={['COMPRAS', 'BODEGUERO']}><Compras /></ProtectedRoute>} />
      <Route path="/cuarentena" element={<ProtectedRoute roles={['DIRECTOR_TECNICO', 'BODEGUERO']}><Cuarentena /></ProtectedRoute>} />
      <Route path="/cotizaciones" element={<ProtectedRoute roles={['VENDEDOR']}><Cotizaciones /></ProtectedRoute>} />
      <Route path="/pedidos" element={<ProtectedRoute roles={['VENDEDOR', 'CARTERA', 'GERENCIA', 'BODEGUERO']}><Pedidos /></ProtectedRoute>} />
      <Route path="/picking" element={<ProtectedRoute roles={['BODEGUERO']}><Picking /></ProtectedRoute>} />
      <Route path="/facturas" element={<ProtectedRoute roles={['CONTABILIDAD', 'GERENCIA']}><Facturas /></ProtectedRoute>} />
      <Route path="/auditoria" element={<ProtectedRoute roles={['GERENCIA']}><Auditoria /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute roles={['ADMIN']}><Usuarios /></ProtectedRoute>} />
      <Route path="*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    </Routes>
  );
}
