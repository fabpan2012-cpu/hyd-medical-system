const COLOR_MAP = {
  // Genéricos
  ACTIVO: 'green', INACTIVO: 'gray',
  // Ordenes de compra
  GENERADA: 'blue', RECIBIDA_PARCIAL: 'yellow', RECIBIDA_TOTAL: 'green', CERRADA: 'gray', ANULADA: 'red',
  // Lotes
  CUARENTENA: 'yellow', DISPONIBLE: 'green', RECHAZADO: 'red', AGOTADO: 'gray',
  // Cotizaciones / Pedidos
  BORRADOR: 'gray', FRENADA_REG_SANITARIO: 'red', CONFIRMADA: 'blue',
  PENDIENTE_CREDITO: 'yellow', BLOQUEADO_CREDITO: 'red', APROBADO: 'green',
  RESERVADO: 'blue', PICKING: 'blue', DESPACHADO: 'blue', FACTURADO: 'green',
  // Facturas
  PENDIENTE: 'yellow', ENVIADA: 'blue', ACEPTADA: 'green',
};

export default function EstadoBadge({ estado }) {
  const color = COLOR_MAP[estado] || 'gray';
  return <span className={`badge badge-${color}`}>{estado?.replaceAll('_', ' ')}</span>;
}
