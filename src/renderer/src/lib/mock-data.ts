import type { AppApi } from '../../../shared/contracts/api'
import type {
  Cliente,
  ClienteHistorial,
  Dashboard,
  DashboardActividadDia,
  Empleado,
  EstadoRegistro,
  Insumo,
  MovimientoCaja,
  OrdenResumen,
  ReporteResumen,
  ResumenCaja,
  Servicio,
  Vehiculo
} from '../../../shared/types/domain'
import type {
  ClienteConVehiculoInput,
  ClienteInput,
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
} from '../../../shared/schemas/inputs'

let nextId = 100

function id(): number {
  return nextId++
}

let SERVICIOS: Servicio[] = [
  { id: 1, nombre: 'Lavado Exterior', descripcion: 'Lavado de carrocería', categoria: 'Exterior', precio: 25, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 2, nombre: 'Lavado Completo', descripcion: 'Lavado interior y exterior', categoria: 'Completo', precio: 45, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 3, nombre: 'Lavado Premium', descripcion: 'Lavado completo con encerado', categoria: 'Premium', precio: 65, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 4, nombre: 'Encerado', descripcion: 'Cera líquida', categoria: 'Exterior', precio: 35, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 5, nombre: 'Aspirado', descripcion: 'Aspirado interior', categoria: 'Interior', precio: 15, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 6, nombre: 'Lavado de Motor', descripcion: 'Limpieza de motor', categoria: 'Motor', precio: 50, estado: 'INACTIVO', eliminacionProgramadaEn: null },
  { id: 7, nombre: 'Tapicería', descripcion: 'Limpieza de tapizados', categoria: 'Tapicería', precio: 40, estado: 'ACTIVO', eliminacionProgramadaEn: null }
]

let CLIENTES: Cliente[] = [
  { id: 1, nombre: 'Cliente Demo 1', telefono: '77712345', creadoEn: new Date(0).toISOString(), estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 2, nombre: 'Cliente Demo 2', telefono: '77723456', creadoEn: new Date(0).toISOString(), estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 3, nombre: 'Cliente Demo 3', telefono: '77734567', creadoEn: new Date(0).toISOString(), estado: 'INACTIVO', eliminacionProgramadaEn: null }
]

let VEHICULOS: Vehiculo[] = [
  { id: 1, clienteId: 1, placa: 'ABC-123', marca: 'Toyota', modelo: 'Corolla', color: 'Rojo', tipo: 'Automóvil', observaciones: '', estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 2, clienteId: 1, placa: 'DEF-456', marca: 'Honda', modelo: 'Civic', color: 'Negro', tipo: 'Automóvil', observaciones: 'Cuidado con pintura', estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 3, clienteId: 2, placa: 'GHI-789', marca: 'Suzuki', modelo: 'Swift', color: 'Blanco', tipo: 'Automóvil', observaciones: '', estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 4, clienteId: 3, placa: 'JKL-012', marca: 'Nissan', modelo: 'NP300', color: 'Gris', tipo: 'Camioneta', observaciones: 'Cliente con deuda', estado: 'INACTIVO', eliminacionProgramadaEn: null }
]

function generarActividadSemanal(desde: string, hasta: string): DashboardActividadDia[] {
  const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
  const desdeDate = new Date(desde + 'T00:00:00')
  const hastaDate = new Date(hasta + 'T23:59:59')
  const dias: DashboardActividadDia[] = []
  const current = new Date(desdeDate)

  while (current <= hastaDate) {
    dias.push({
      fecha: current.toISOString().slice(0, 10),
      etiqueta: DIAS[current.getDay()],
      autos: Math.floor(Math.random() * 15) + 3,
      facturacion: Math.floor(Math.random() * 500) + 100,
      ingresos: Math.floor(Math.random() * 600) + 150,
      egresos: Math.floor(Math.random() * 200) + 30
    })
    current.setDate(current.getDate() + 1)
  }
  return dias
}

function rangeDays(desde: string, hasta: string): number {
  const ms = new Date(hasta + 'T23:59:59').getTime() - new Date(desde + 'T00:00:00').getTime()
  return Math.round(ms / 86_400_000) + 1
}

export function createMockApi(): AppApi {
  return {
    dashboard: async (filtro: ReporteFiltroInput): Promise<Dashboard> => {
      const actividad = generarActividadSemanal(filtro.desde, filtro.hasta)
      const totalAuts = actividad.reduce((s, d) => s + d.autos, 0)
      const totalFac = actividad.reduce((s, d) => s + d.facturacion, 0)
      const totalIng = actividad.reduce((s, d) => s + d.ingresos, 0)
      const totalEgr = actividad.reduce((s, d) => s + d.egresos, 0)

      return {
        desde: filtro.desde,
        hasta: filtro.hasta,
        clientes: CLIENTES.filter((c) => c.estado === 'ACTIVO').length,
        ordenesPendientes: Math.floor(Math.random() * 8) + 2,
        insumosCriticos: Math.floor(Math.random() * 3),
        autosAtendidosHoy: totalAuts,
        facturacionHoy: totalFac,
        servicioMasVendido: {
          nombre: SERVICIOS[0].nombre,
          cantidad: totalAuts
        },
        insumoMasBajo: {
          nombre: 'Shampoo Neutro',
          paquetes: 3,
          tipoPaquete: 'Botella'
        },
        ingresosHoy: totalIng,
        egresosHoy: totalEgr,
        resultadoHoy: totalIng - totalEgr,
        actividadSemanal: actividad,
        serviciosVendidos: SERVICIOS.filter((s) => s.estado === 'ACTIVO').map((s) => ({
          nombre: s.nombre,
          cantidad: Math.floor(Math.random() * 15) + 1
        })),
        inventarioActual: [
          { nombre: 'Shampoo Neutro', paquetes: 3, tipoPaquete: 'Botella', contenido: '1L' },
          { nombre: 'Cera Líquida', paquetes: 2, tipoPaquete: 'Botella', contenido: '500ml' },
          { nombre: 'Esponjas', paquetes: 8, tipoPaquete: 'Paquete', contenido: '5 und' }
        ]
      }
    },

    clientes: {
      listar: async (): Promise<Cliente[]> => [...CLIENTES],
      crear: async (input: ClienteInput): Promise<Cliente> => {
        const c: Cliente = { id: id(), nombre: input.nombre, telefono: input.telefono, creadoEn: new Date().toISOString(), estado: 'ACTIVO', eliminacionProgramadaEn: null }
        CLIENTES = [...CLIENTES, c]
        return c
      },
      crearConVehiculo: async (input: ClienteConVehiculoInput): Promise<Cliente> => {
        const c: Cliente = { id: id(), nombre: input.nombre, telefono: input.telefono, creadoEn: new Date().toISOString(), estado: 'ACTIVO', eliminacionProgramadaEn: null }
        CLIENTES = [...CLIENTES, c]
        if (input.vehiculo) {
          const v: Vehiculo = { id: id(), clienteId: c.id, placa: input.vehiculo.placa, marca: input.vehiculo.marca, modelo: input.vehiculo.modelo, color: input.vehiculo.color ?? '', tipo: input.vehiculo.tipo, observaciones: input.vehiculo.observaciones ?? '', estado: 'ACTIVO', eliminacionProgramadaEn: null }
          VEHICULOS = [...VEHICULOS, v]
        }
        return c
      },
      actualizar: async (clienteId: number, input: ClienteInput): Promise<Cliente> => {
        const c = CLIENTES.find((x) => x.id === clienteId)
        const updated: Cliente = { ...(c ?? CLIENTES[0]), nombre: input.nombre, telefono: input.telefono, estado: 'ACTIVO' }
        CLIENTES = CLIENTES.map((x) => (x.id === clienteId ? updated : x))
        return updated
      },
      eliminar: async (clienteId: number): Promise<void> => {
        CLIENTES = CLIENTES.map((c) => (c.id === clienteId ? { ...c, estado: 'INACTIVO', eliminacionProgramadaEn: new Date().toISOString() } : c))
      },
      cancelarEliminacion: async (clienteId: number): Promise<void> => {
        CLIENTES = CLIENTES.map((c) => (c.id === clienteId ? { ...c, estado: 'ACTIVO', eliminacionProgramadaEn: null } : c))
      },
      historial: async (_clienteId: number): Promise<ClienteHistorial> => ({
        visitas: Math.floor(Math.random() * 20) + 1,
        totalGastado: Math.floor(Math.random() * 1000) + 100,
        ultimaVisita: new Date().toISOString()
      })
    },

    vehiculos: {
      listar: async (): Promise<Vehiculo[]> => [...VEHICULOS],
      crear: async (input: VehiculoInput): Promise<Vehiculo> => {
        const v: Vehiculo = { id: id(), clienteId: input.clienteId, placa: input.placa, marca: input.marca, modelo: input.modelo, color: input.color ?? '', tipo: input.tipo, observaciones: input.observaciones ?? '', estado: 'ACTIVO', eliminacionProgramadaEn: null }
        VEHICULOS = [...VEHICULOS, v]
        return v
      },
      actualizar: async (vehiculoId: number, input: VehiculoInput): Promise<Vehiculo> => {
        const existing = VEHICULOS.find((v) => v.id === vehiculoId)
        const updated: Vehiculo = { ...(existing ?? VEHICULOS[0]), clienteId: input.clienteId, placa: input.placa, marca: input.marca, modelo: input.modelo, color: input.color ?? '', tipo: input.tipo, observaciones: input.observaciones ?? '' }
        VEHICULOS = VEHICULOS.map((v) => (v.id === vehiculoId ? updated : v))
        return updated
      },
      eliminar: async (vehiculoId: number): Promise<void> => {
        VEHICULOS = VEHICULOS.map((v) => (v.id === vehiculoId ? { ...v, estado: 'INACTIVO', eliminacionProgramadaEn: new Date().toISOString() } : v))
      },
      cancelarEliminacion: async (vehiculoId: number): Promise<void> => {
        VEHICULOS = VEHICULOS.map((v) => (v.id === vehiculoId ? { ...v, estado: 'ACTIVO', eliminacionProgramadaEn: null } : v))
      }
    },

    servicios: {
      listar: async (): Promise<Servicio[]> => [...SERVICIOS],
      crear: async (input: ServicioInput): Promise<Servicio> => {
        const s: Servicio = { id: id(), nombre: input.nombre, descripcion: input.descripcion ?? '', categoria: input.categoria, precio: input.precio, estado: 'ACTIVO', eliminacionProgramadaEn: null }
        SERVICIOS = [...SERVICIOS, s]
        return s
      },
      actualizar: async (servicioId: number, input: ServicioInput): Promise<Servicio> => {
        const existing = SERVICIOS.find((s) => s.id === servicioId) ?? SERVICIOS[0]
        const updated: Servicio = { ...existing, nombre: input.nombre, descripcion: input.descripcion ?? '', categoria: input.categoria, precio: input.precio }
        SERVICIOS = SERVICIOS.map((s) => (s.id === servicioId ? updated : s))
        return updated
      },
      cambiarEstado: async (servicioId: number, estado: EstadoRegistro): Promise<void> => {
        SERVICIOS = SERVICIOS.map((s) => (s.id === servicioId ? { ...s, estado, eliminacionProgramadaEn: null } : s))
      },
      eliminar: async (servicioId: number): Promise<void> => {
        SERVICIOS = SERVICIOS.map((s) => (s.id === servicioId ? { ...s, estado: 'INACTIVO', eliminacionProgramadaEn: new Date().toISOString() } : s))
      }
    },

    empleados: {
      listar: async (): Promise<Empleado[]> => {
        const base: Empleado[] = [
          { id: 1, nombres: 'Juan', apellidos: 'Pérez', telefono: '77712345', cargo: 'Lavador', salario: 100, tipoPago: 'Día', estado: 'ACTIVO', eliminacionProgramadaEn: null },
          { id: 2, nombres: 'María', apellidos: 'García', telefono: '77723456', cargo: 'Cajero', salario: 3500, tipoPago: 'Mes', estado: 'ACTIVO', eliminacionProgramadaEn: null },
          { id: 3, nombres: 'Carlos', apellidos: 'López', telefono: '77734567', cargo: 'Lavador', salario: 100, tipoPago: 'Día', estado: 'INACTIVO', eliminacionProgramadaEn: null }
        ]
        base.forEach((e) => {
          if (!_empleados.some((x) => x.id === e.id)) _empleados.push(e)
        })
        return [..._empleados]
      },
      crear: async (input: EmpleadoInput): Promise<Empleado> => {
        const e: Empleado = { id: id(), nombres: input.nombres, apellidos: input.apellidos, telefono: input.telefono, cargo: input.cargo, salario: input.salario, tipoPago: input.tipoPago, estado: 'ACTIVO', eliminacionProgramadaEn: null }
        _empleados = [..._empleados, e]
        return e
      },
      actualizar: async (empleadoId: number, input: EmpleadoInput): Promise<Empleado> => {
        const existing = _empleados.find((e) => e.id === empleadoId)
        const updated: Empleado = { ...(existing ?? _empleados[0]), nombres: input.nombres, apellidos: input.apellidos, telefono: input.telefono, cargo: input.cargo, salario: input.salario, tipoPago: input.tipoPago }
        _empleados = _empleados.map((e) => (e.id === empleadoId ? updated : e))
        return updated
      },
      eliminar: async (empleadoId: number): Promise<void> => {
        _empleados = _empleados.map((e) => (e.id === empleadoId ? { ...e, estado: 'INACTIVO', eliminacionProgramadaEn: new Date().toISOString() } : e))
      },
      cambiarEstado: async (empleadoId: number, estado: EstadoRegistro): Promise<void> => {
        _empleados = _empleados.map((e) => (e.id === empleadoId ? { ...e, estado, eliminacionProgramadaEn: null } : e))
      },
      pagarSalario: async (): Promise<void> => undefined
    },

    inventario: {
      listar: async (): Promise<Insumo[]> => [..._insumos],
      crear: async (input: InsumoInput): Promise<Insumo> => {
        const i: Insumo = { id: id(), nombre: input.nombre, tipoPaquete: input.tipoPaquete, contenido: input.contenido, paquetes: input.paquetes, paquetesMinimo: input.paquetesMinimo, estado: 'ACTIVO', eliminacionProgramadaEn: null }
        _insumos = [..._insumos, i]
        return i
      },
      actualizar: async (insumoId: number, input: InsumoUpdateInput): Promise<Insumo> => {
        const existing = _insumos.find((i) => i.id === insumoId)
        const updated: Insumo = { ...(existing ?? _insumos[0]), nombre: input.nombre ?? existing?.nombre ?? '', tipoPaquete: input.tipoPaquete ?? existing?.tipoPaquete ?? '', contenido: input.contenido ?? existing?.contenido ?? '', paquetes: input.paquetes ?? existing?.paquetes ?? 0, paquetesMinimo: input.paquetesMinimo ?? existing?.paquetesMinimo ?? 0 }
        _insumos = _insumos.map((i) => (i.id === insumoId ? updated : i))
        return updated
      },
      eliminar: async (insumoId: number): Promise<void> => {
        _insumos = _insumos.map((i) => (i.id === insumoId ? { ...i, estado: 'INACTIVO', eliminacionProgramadaEn: new Date().toISOString() } : i))
      },
      cambiarEstado: async (insumoId: number, estado: EstadoRegistro): Promise<void> => {
        _insumos = _insumos.map((i) => (i.id === insumoId ? { ...i, estado, eliminacionProgramadaEn: null } : i))
      },
      comprar: async (_input: CompraInsumoInput): Promise<void> => undefined
    },

    ordenes: {
      listar: async (): Promise<OrdenResumen[]> => [..._ordenes].sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso)),
      crear: async (input: OrdenInput): Promise<OrdenResumen> => {
        const o: OrdenResumen = { id: id(), vehiculoId: input.vehiculoId, servicioIds: input.servicioIds, cliente: 'Demo', placa: 'ABC-123', descuento: input.descuento ?? 0, total: 40, estado: 'PENDIENTE', estadoOperativo: 'RECIBIDO', metodoPago: input.metodoPago, fechaIngreso: new Date().toISOString(), fechaCompletada: null }
        _ordenes = [..._ordenes, o]
        return o
      },
      actualizar: async (ordenId: number, input: OrdenInput): Promise<OrdenResumen> => {
        const existing = _ordenes.find((o) => o.id === ordenId)
        const updated: OrdenResumen = { ...(existing ?? _ordenes[0]), vehiculoId: input.vehiculoId, servicioIds: input.servicioIds, descuento: input.descuento ?? 0, metodoPago: input.metodoPago }
        _ordenes = _ordenes.map((o) => (o.id === ordenId ? updated : o))
        return updated
      },
      eliminar: async (ordenId: number): Promise<void> => {
        _ordenes = _ordenes.filter((o) => o.id !== ordenId)
      },
      iniciar: async (ordenId: number): Promise<void> => {
        _ordenes = _ordenes.map((o) => (o.id === ordenId ? { ...o, estadoOperativo: 'EN_PROCESO' as const } : o))
      },
      marcarLista: async (ordenId: number): Promise<void> => {
        _ordenes = _ordenes.map((o) => (o.id === ordenId ? { ...o, estadoOperativo: 'LISTO' as const } : o))
      },
      entregar: async (ordenId: number): Promise<void> => {
        _ordenes = _ordenes.map((o) => (o.id === ordenId ? { ...o, estadoOperativo: 'ENTREGADO' as const, estado: 'COMPLETADA' as const, fechaCompletada: new Date().toISOString() } : o))
      },
      cancelar: async (ordenId: number): Promise<void> => {
        _ordenes = _ordenes.map((o) => (o.id === ordenId ? { ...o, estadoOperativo: 'CANCELADO' as const } : o))
      },
      revertirInicio: async (ordenId: number): Promise<void> => {
        _ordenes = _ordenes.map((o) => (o.id === ordenId ? { ...o, estadoOperativo: 'RECIBIDO' as const } : o))
      }
    },

    caja: {
      resumen: async (): Promise<ResumenCaja> => {
        const movs: MovimientoCaja[] = [
          { id: 1, fecha: new Date().toISOString(), tipo: 'INGRESO', categoria: 'Servicios', concepto: 'Lavado Completo', monto: 45, saldo: 45, metodoPago: 'EFECTIVO' },
          { id: 2, fecha: new Date().toISOString(), tipo: 'EGRESO', categoria: 'Insumos', concepto: 'Compra Shampoo', monto: 30, saldo: 15, metodoPago: null },
          { id: 3, fecha: new Date().toISOString(), tipo: 'INGRESO', categoria: 'Servicios', concepto: 'Lavado Exterior', monto: 25, saldo: 40, metodoPago: 'QR' }
        ]
        return { ingresos: 70, egresos: 30, utilidad: 40, movimientos: movs }
      },
      registrarEgreso: async (_input: EgresoInput): Promise<void> => undefined,
      registrarMovimiento: async (_input: MovimientoManualInput): Promise<void> => undefined
    },

    reportes: {
      obtener: async (filtro: ReporteFiltroInput): Promise<ReporteResumen> => {
        const days = rangeDays(filtro.desde, filtro.hasta)
        return {
          desde: filtro.desde,
          hasta: filtro.hasta,
          autosAtendidos: days * 8,
          facturacion: days * 350,
          ingresos: days * 400,
          egresos: days * 120,
          resultado: days * 280,
          servicioMasVendido: SERVICIOS[0].nombre,
          servicios: SERVICIOS.filter((s) => s.estado === 'ACTIVO').map((s) => ({
            nombre: s.nombre,
            cantidad: Math.floor(Math.random() * 20) + 1,
            facturacion: Math.floor(Math.random() * 500) + 100
          })),
          ordenes: Array.from({ length: Math.min(days * 3, 20) }, (_, i) => ({
            id: i + 1,
            fecha: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
            cliente: CLIENTES[i % CLIENTES.length].nombre,
            placa: VEHICULOS[i % VEHICULOS.length].placa,
            servicios: SERVICIOS[i % SERVICIOS.length].nombre,
            metodoPago: (['EFECTIVO', 'QR', 'TRANSFERENCIA'] as const)[i % 3],
            total: Math.floor(Math.random() * 60) + 15
          }))
        }
      },
      exportarPdf: async (): Promise<string | null> => null,
      exportarExcel: async (): Promise<string | null> => null
    }
  }
}

let _empleados: Empleado[] = [
  { id: 1, nombres: 'Juan', apellidos: 'Pérez', telefono: '77712345', cargo: 'Lavador', salario: 100, tipoPago: 'Día', estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 2, nombres: 'María', apellidos: 'García', telefono: '77723456', cargo: 'Cajero', salario: 3500, tipoPago: 'Mes', estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 3, nombres: 'Carlos', apellidos: 'López', telefono: '77734567', cargo: 'Lavador', salario: 100, tipoPago: 'Día', estado: 'INACTIVO', eliminacionProgramadaEn: null }
]

let _insumos: Insumo[] = [
  { id: 1, nombre: 'Shampoo Neutro', tipoPaquete: 'Botella', contenido: '1L', paquetes: 3, paquetesMinimo: 5, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 2, nombre: 'Cera Líquida', tipoPaquete: 'Botella', contenido: '500ml', paquetes: 2, paquetesMinimo: 3, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 3, nombre: 'Esponjas', tipoPaquete: 'Paquete', contenido: '5 und', paquetes: 8, paquetesMinimo: 3, estado: 'ACTIVO', eliminacionProgramadaEn: null },
  { id: 4, nombre: 'Franelas', tipoPaquete: 'Paquete', contenido: '10 und', paquetes: 1, paquetesMinimo: 4, estado: 'ACTIVO', eliminacionProgramadaEn: null }
]

let _ordenes: OrdenResumen[] = (() => {
  const time = new Date().toISOString()
  return [
    { id: 1, vehiculoId: 1, servicioIds: [1, 5], cliente: 'Cliente Demo 1', placa: 'ABC-123', descuento: 0, total: 40, estado: 'COMPLETADA', estadoOperativo: 'ENTREGADO', metodoPago: 'EFECTIVO', fechaIngreso: time, fechaCompletada: time },
    { id: 2, vehiculoId: 2, servicioIds: [2], cliente: 'Cliente Demo 1', placa: 'DEF-456', descuento: 5, total: 40, estado: 'PENDIENTE', estadoOperativo: 'RECIBIDO', metodoPago: 'QR', fechaIngreso: time, fechaCompletada: null },
    { id: 3, vehiculoId: 3, servicioIds: [1], cliente: 'Cliente Demo 2', placa: 'GHI-789', descuento: 0, total: 25, estado: 'COMPLETADA', estadoOperativo: 'EN_PROCESO', metodoPago: 'EFECTIVO', fechaIngreso: time, fechaCompletada: null }
  ]
})()
