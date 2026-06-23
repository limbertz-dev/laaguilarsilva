export type EstadoRegistro = 'ACTIVO' | 'INACTIVO'
export type EstadoOrden = 'PENDIENTE' | 'COMPLETADA' | 'CANCELADA'
export type TipoMovimiento = 'INGRESO' | 'EGRESO'
export type EstadoOperativo = 'RECIBIDO' | 'EN_PROCESO' | 'LISTO' | 'ENTREGADO' | 'CANCELADO'
export type MetodoPago = 'EFECTIVO' | 'QR' | 'TRANSFERENCIA'

export interface Cliente {
  id: number
  nombre: string
  telefono: string
  creadoEn: string
  estado: EstadoRegistro
  eliminacionProgramadaEn: string | null
}

export interface ClienteHistorial {
  visitas: number
  totalGastado: number
  ultimaVisita: string | null
}

export interface Vehiculo {
  id: number
  clienteId: number
  placa: string
  marca: string
  modelo: string
  color: string
  tipo: string
  observaciones: string
  estado: EstadoRegistro
  eliminacionProgramadaEn: string | null
}

export interface Servicio {
  id: number
  nombre: string
  descripcion: string
  categoria: string
  precio: number
  estado: EstadoRegistro
  eliminacionProgramadaEn: string | null
  insumos: ServicioInsumo[]
}

export interface ServicioInsumo {
  insumoId: number
  nombre: string
  unidad: string
  cantidad: number
}

export interface Empleado {
  id: number
  nombres: string
  apellidos: string
  telefono: string
  cargo: string
  salario: number
  estado: EstadoRegistro
  eliminacionProgramadaEn: string | null
}

export interface Insumo {
  id: number
  nombre: string
  unidad: string
  stockActual: number
  stockMinimo: number
  estado: EstadoRegistro
  eliminacionProgramadaEn: string | null
}

export interface OrdenResumen {
  id: number
  vehiculoId: number
  servicioIds: number[]
  cliente: string
  placa: string
  descuento: number
  total: number
  estado: EstadoOrden
  estadoOperativo: EstadoOperativo
  metodoPago: MetodoPago
  fechaIngreso: string
  fechaCompletada: string | null
}

export interface MovimientoCaja {
  id: number
  fecha: string
  tipo: TipoMovimiento
  categoria: string
  concepto: string
  monto: number
  saldo: number
  metodoPago: MetodoPago | null
}

export interface ResumenCaja {
  ingresos: number
  egresos: number
  utilidad: number
  movimientos: MovimientoCaja[]
}

export interface Dashboard {
  clientes: number
  ordenesPendientes: number
  insumosCriticos: number
  autosAtendidosHoy: number
  facturacionHoy: number
  servicioMasVendido: {
    nombre: string
    cantidad: number
  } | null
  shampooConsumido: {
    nombre: string
    cantidad: number
    unidad: string
  } | null
  ingresosHoy: number
  egresosHoy: number
  resultadoHoy: number
  actividadSemanal: DashboardActividadDia[]
  serviciosVendidos: DashboardRanking[]
  consumoInsumos: DashboardConsumo[]
}

export interface DashboardActividadDia {
  fecha: string
  etiqueta: string
  autos: number
  facturacion: number
  ingresos: number
  egresos: number
}

export interface DashboardRanking {
  nombre: string
  cantidad: number
}

export interface DashboardConsumo {
  nombre: string
  unidad: string
  cantidad: number
}

export interface ReporteServicio {
  nombre: string
  cantidad: number
  facturacion: number
}

export interface ReporteConsumo {
  insumo: string
  unidad: string
  cantidad: number
}

export interface ReporteOrden {
  id: number
  fecha: string
  cliente: string
  placa: string
  servicios: string
  metodoPago: MetodoPago
  total: number
}

export interface ReporteResumen {
  desde: string
  hasta: string
  autosAtendidos: number
  facturacion: number
  ingresos: number
  egresos: number
  resultado: number
  servicioMasVendido: string | null
  servicios: ReporteServicio[]
  consumos: ReporteConsumo[]
  ordenes: ReporteOrden[]
}
