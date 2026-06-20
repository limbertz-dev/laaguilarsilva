import type {
  Cliente,
  ClienteHistorial,
  Dashboard,
  Empleado,
  Insumo,
  OrdenResumen,
  ReporteResumen,
  ResumenCaja,
  Servicio,
  Vehiculo
} from '../types/domain'
import type {
  ClienteInput,
  ClienteConVehiculoInput,
  CompraInsumoInput,
  EgresoInput,
  EmpleadoInput,
  InsumoInput,
  InsumoUpdateInput,
  MovimientoManualInput,
  OrdenInput,
  ReporteFiltroInput,
  ServicioInput,
  VehiculoInput
} from '../schemas/inputs'

export interface AppApi {
  dashboard: () => Promise<Dashboard>
  clientes: {
    listar: () => Promise<Cliente[]>
    crear: (input: ClienteInput) => Promise<Cliente>
    crearConVehiculo: (input: ClienteConVehiculoInput) => Promise<Cliente>
    actualizar: (clienteId: number, input: ClienteInput) => Promise<Cliente>
    eliminar: (clienteId: number) => Promise<void>
    historial: (clienteId: number) => Promise<ClienteHistorial>
  }
  vehiculos: {
    listar: () => Promise<Vehiculo[]>
    crear: (input: VehiculoInput) => Promise<Vehiculo>
    actualizar: (vehiculoId: number, input: VehiculoInput) => Promise<Vehiculo>
    eliminar: (vehiculoId: number) => Promise<void>
  }
  servicios: {
    listar: () => Promise<Servicio[]>
    crear: (input: ServicioInput) => Promise<Servicio>
    actualizar: (servicioId: number, input: ServicioInput) => Promise<Servicio>
    eliminar: (servicioId: number) => Promise<void>
  }
  empleados: {
    listar: () => Promise<Empleado[]>
    crear: (input: EmpleadoInput) => Promise<Empleado>
    actualizar: (empleadoId: number, input: EmpleadoInput) => Promise<Empleado>
    eliminar: (empleadoId: number) => Promise<void>
    pagarSalario: (empleadoId: number) => Promise<void>
  }
  inventario: {
    listar: () => Promise<Insumo[]>
    crear: (input: InsumoInput) => Promise<Insumo>
    actualizar: (insumoId: number, input: InsumoUpdateInput) => Promise<Insumo>
    eliminar: (insumoId: number) => Promise<void>
    comprar: (input: CompraInsumoInput) => Promise<void>
  }
  ordenes: {
    listar: () => Promise<OrdenResumen[]>
    crear: (input: OrdenInput) => Promise<OrdenResumen>
    actualizar: (ordenId: number, input: OrdenInput) => Promise<OrdenResumen>
    eliminar: (ordenId: number) => Promise<void>
    iniciar: (ordenId: number) => Promise<void>
    marcarLista: (ordenId: number) => Promise<void>
    entregar: (ordenId: number) => Promise<void>
    cancelar: (ordenId: number) => Promise<void>
  }
  caja: {
    resumen: () => Promise<ResumenCaja>
    registrarEgreso: (input: EgresoInput) => Promise<void>
    registrarMovimiento: (input: MovimientoManualInput) => Promise<void>
  }
  reportes: {
    obtener: (filtro: ReporteFiltroInput) => Promise<ReporteResumen>
    exportarPdf: (filtro: ReporteFiltroInput) => Promise<string | null>
    exportarExcel: (filtro: ReporteFiltroInput) => Promise<string | null>
  }
}
