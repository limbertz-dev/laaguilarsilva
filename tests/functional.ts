import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { closeDatabase, getDatabase, initializeDatabase } from '../src/main/database/connection'
import {
  actualizarCliente,
  crearCliente,
  crearClienteConVehiculo,
  eliminarCliente,
  listarClientes,
  obtenerHistorialCliente
} from '../src/main/modules/clientes/service'
import {
  actualizarVehiculo,
  crearVehiculo,
  eliminarVehiculo,
  listarVehiculos
} from '../src/main/modules/vehiculos/service'
import {
  actualizarServicio,
  cambiarEstadoServicio,
  crearServicio,
  eliminarServicio,
  listarServicios
} from '../src/main/modules/servicios/service'
import {
  actualizarEmpleado,
  crearEmpleado,
  eliminarEmpleado,
  listarEmpleados,
  pagarSalario
} from '../src/main/modules/empleados/service'
import {
  actualizarInsumo,
  comprarInsumo,
  crearInsumo,
  eliminarInsumo,
  listarInsumos
} from '../src/main/modules/inventario/service'
import {
  actualizarOrden,
  cancelarOrden,
  crearOrden,
  entregarOrden,
  eliminarOrden,
  iniciarOrden,
  listarOrdenes,
  marcarOrdenLista
} from '../src/main/modules/ordenes/service'
import { obtenerResumenCaja, registrarMovimiento } from '../src/main/modules/caja/service'
import { obtenerDashboard } from '../src/main/modules/dashboard/service'
import { obtenerReporte } from '../src/main/modules/reportes/service'
import { parseDecimal } from '../src/renderer/src/utils/form'

const path = join(tmpdir(), 'laaguilarsilva-functional.sqlite')
rmSync(path, { force: true })
const legacyDatabase = new DatabaseSync(path)
legacyDatabase.exec(`
  CREATE TABLE vehiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    placa TEXT NOT NULL UNIQUE,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '',
    tipo TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE ordenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehiculo_id INTEGER NOT NULL,
    empleado_id INTEGER NOT NULL,
    subtotal_centavos INTEGER NOT NULL,
    descuento_centavos INTEGER NOT NULL DEFAULT 0,
    total_centavos INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE',
    observaciones TEXT NOT NULL DEFAULT '',
    fecha_ingreso TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_completada TEXT
  );
  CREATE TABLE movimientos_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    concepto TEXT NOT NULL,
    monto_centavos INTEGER NOT NULL,
    origen TEXT NOT NULL,
    origen_id INTEGER,
    UNIQUE (origen, origen_id)
  );
`)
legacyDatabase.close()
initializeDatabase(path)

try {
  if (parseDecimal('12,50') !== 12.5 || parseDecimal(' 1  ') !== 1) {
    throw new Error('La conversión de números con coma decimal no funciona')
  }

  const clienteCompleto = crearClienteConVehiculo({
    nombre: 'Cliente con vehículo',
    telefono: '76666666',
    vehiculo: {
      placa: 'JUN001',
      marca: 'Nissan',
      modelo: 'March',
      color: 'Azul',
      tipo: 'Automóvil',
      observaciones: 'Rayón previo en puerta derecha'
    }
  })
  const vehiculoCompleto = listarVehiculos().find((item) => item.clienteId === clienteCompleto.id)
  if (!vehiculoCompleto || vehiculoCompleto.observaciones !== 'Rayón previo en puerta derecha') {
    throw new Error('El registro conjunto no creó el vehículo con sus observaciones')
  }

  const totalClientesAntesDeFallo = listarClientes().length
  let registroConjuntoBloqueado = false
  try {
    crearClienteConVehiculo({
      nombre: 'Cliente no persistente',
      telefono: '75555555',
      vehiculo: {
        placa: 'JUN001',
        marca: 'Toyota',
        modelo: 'Yaris',
        color: '',
        tipo: 'Automóvil'
      }
    })
  } catch {
    registroConjuntoBloqueado = true
  }
  if (!registroConjuntoBloqueado || listarClientes().length !== totalClientesAntesDeFallo) {
    throw new Error('El registro conjunto no revirtió el cliente después del fallo del vehículo')
  }

  const cliente = crearCliente({ nombre: 'Cliente prueba', telefono: '70000000' })
  const vehiculo = crearVehiculo({
    clienteId: cliente.id,
    placa: 'TST001',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    tipo: 'Automóvil'
  })
  const clienteActualizado = actualizarCliente(cliente.id, {
    nombre: 'Cliente prueba editado',
    telefono: '79999999'
  })
  const vehiculoActualizado = actualizarVehiculo(vehiculo.id, {
    clienteId: cliente.id,
    placa: 'TST002',
    marca: 'Toyota',
    modelo: 'Corolla XEI',
    color: 'Negro',
    tipo: 'Automóvil'
  })
  if (
    clienteActualizado.telefono !== '79999999' ||
    vehiculoActualizado.placa !== 'TST002' ||
    vehiculoActualizado.modelo !== 'Corolla XEI'
  ) {
    throw new Error('La actualización de cliente o vehículo no persistió')
  }

  const clienteDescartable = crearCliente({
    nombre: 'Cliente descartable',
    telefono: '78888888'
  })
  const vehiculoDescartable = crearVehiculo({
    clienteId: clienteDescartable.id,
    placa: 'DEL001',
    marca: 'Suzuki',
    modelo: 'Swift',
    color: 'Rojo',
    tipo: 'Automóvil'
  })
  eliminarVehiculo(vehiculoDescartable.id)
  eliminarCliente(clienteDescartable.id)
  if (
    listarVehiculos().some((item) => item.id === vehiculoDescartable.id) ||
    listarClientes().some((item) => item.id === clienteDescartable.id)
  ) {
    throw new Error('El cliente o vehículo eliminado continúa registrado')
  }
  const servicio = crearServicio({
    nombre: 'Lavado funcional',
    descripcion: 'Prueba',
    categoria: 'Exterior',
    precio: 10
  })
  const servicioDescartable = crearServicio({
    nombre: 'Servicio descartable',
    descripcion: 'Sin historial',
    categoria: 'Exterior',
    precio: 5
  })
  eliminarServicio(servicioDescartable.id)
  const servicioDescartableProgramado = listarServicios().find(
    (item) => item.id === servicioDescartable.id
  )
  if (
    servicioDescartableProgramado?.estado !== 'INACTIVO' ||
    !servicioDescartableProgramado.eliminacionProgramadaEn
  ) {
    throw new Error('El servicio eliminado no quedó programado para ocultarse')
  }
  getDatabase()
    .prepare(
      "UPDATE servicios SET eliminacion_programada_en = datetime('now', '-1 minute') WHERE id = ?"
    )
    .run(servicioDescartable.id)
  if (listarServicios().some((item) => item.id === servicioDescartable.id)) {
    throw new Error('El servicio eliminado continúa visible después de vencer la programación')
  }
  let servicioDuplicadoBloqueado = false
  try {
    crearServicio({
      nombre: '  lavado   funcional ',
      descripcion: '',
      categoria: 'Exterior',
      precio: 10
    })
  } catch {
    servicioDuplicadoBloqueado = true
  }
  if (!servicioDuplicadoBloqueado) {
    throw new Error('Se permitió registrar un servicio duplicado')
  }
  const empleado = crearEmpleado({
    nombres: 'Empleado',
    apellidos: 'Prueba',
    telefono: '71111111',
    cargo: 'Lavador',
    salario: 400
  })
  const insumo = crearInsumo({ nombre: 'Shampoo funcional', unidad: 'Litro', stockMinimo: 1 })
  comprarInsumo({ insumoId: insumo.id, cantidad: 3, costoUnitario: 2 })
  let insumoDuplicadoBloqueado = false
  try {
    crearInsumo({ nombre: ' shampoo   funcional ', unidad: 'Litro', stockMinimo: 1 })
  } catch {
    insumoDuplicadoBloqueado = true
  }
  if (!insumoDuplicadoBloqueado) {
    throw new Error('Se permitió registrar un insumo duplicado')
  }
  const orden = crearOrden({
    vehiculoId: vehiculo.id,
    servicioIds: [servicio.id],
    descuento: 0,
    metodoPago: 'QR'
  })

  let eliminacionVehiculoBloqueada = false
  try {
    eliminarVehiculo(vehiculo.id)
  } catch {
    eliminacionVehiculoBloqueada = true
  }
  if (!eliminacionVehiculoBloqueada) {
    throw new Error('Se eliminó un vehículo que tenía órdenes registradas')
  }

  let eliminacionClienteBloqueada = false
  try {
    eliminarCliente(cliente.id)
  } catch {
    eliminacionClienteBloqueada = true
  }
  if (!eliminacionClienteBloqueada) {
    throw new Error('Se eliminó un cliente que tenía vehículos registrados')
  }

  actualizarServicio(servicio.id, {
    nombre: 'Lavado funcional editado',
    descripcion: 'Prueba editada',
    categoria: 'Exterior',
    precio: 12,
    insumos: [{ insumoId: insumo.id, cantidad: 0.25 }]
  })
  actualizarEmpleado(empleado.id, {
    nombres: 'Empleado',
    apellidos: 'Editado',
    telefono: '72222222',
    cargo: 'Supervisor',
    salario: 450
  })
  actualizarInsumo(insumo.id, {
    nombre: 'Shampoo editado',
    unidad: 'Litro',
    stockMinimo: 2
  })
  const ordenActualizada = actualizarOrden(orden.id, {
    vehiculoId: vehiculo.id,
    servicioIds: [servicio.id],
    descuento: 2,
    metodoPago: 'QR'
  })
  if (ordenActualizada.total !== 10 || ordenActualizada.servicioIds[0] !== servicio.id) {
    throw new Error(`Actualización de orden inesperada: ${JSON.stringify(ordenActualizada)}`)
  }

  const ordenParaEliminar = crearOrden({
    vehiculoId: vehiculo.id,
    servicioIds: [servicio.id],
    descuento: 0,
    metodoPago: 'EFECTIVO'
  })
  eliminarOrden(ordenParaEliminar.id)
  if (listarOrdenes().some((item) => item.id === ordenParaEliminar.id)) {
    throw new Error('La orden pendiente no fue eliminada')
  }

  iniciarOrden(orden.id)
  marcarOrdenLista(orden.id)
  entregarOrden(orden.id)

  actualizarServicio(servicio.id, {
    nombre: 'Lavado funcional editado',
    descripcion: 'Prueba de stock',
    categoria: 'Exterior',
    precio: 12,
    insumos: [{ insumoId: insumo.id, cantidad: 3 }]
  })
  const ordenSinStock = crearOrden({
    vehiculoId: vehiculo.id,
    servicioIds: [servicio.id],
    descuento: 0,
    metodoPago: 'EFECTIVO'
  })
  iniciarOrden(ordenSinStock.id)
  let faltaStockControlada = false
  try {
    marcarOrdenLista(ordenSinStock.id)
  } catch {
    faltaStockControlada = true
  }
  const ordenTrasFallo = listarOrdenes().find((item) => item.id === ordenSinStock.id)
  if (!faltaStockControlada || ordenTrasFallo?.estadoOperativo !== 'EN_PROCESO') {
    throw new Error('La falta de stock no fue controlada correctamente')
  }
  cancelarOrden(ordenSinStock.id)
  eliminarOrden(ordenSinStock.id)
  actualizarServicio(servicio.id, {
    nombre: 'Lavado funcional editado',
    descripcion: 'Prueba editada',
    categoria: 'Exterior',
    precio: 12,
    insumos: [{ insumoId: insumo.id, cantidad: 0.25 }]
  })

  pagarSalario(empleado.id)
  registrarMovimiento({
    tipo: 'INGRESO',
    categoria: 'Venta adicional',
    concepto: 'Producto',
    monto: 25
  })
  registrarMovimiento({
    tipo: 'EGRESO',
    categoria: 'Transporte',
    concepto: 'Servicio taxi',
    monto: 5
  })

  eliminarServicio(servicio.id)
  const servicioProgramado = listarServicios().find((item) => item.id === servicio.id)
  if (servicioProgramado?.estado !== 'INACTIVO' || !servicioProgramado.eliminacionProgramadaEn) {
    throw new Error('El servicio con historial no quedó programado para ocultarse')
  }
  cambiarEstadoServicio(servicio.id, 'ACTIVO')
  const servicioReactivado = listarServicios().find((item) => item.id === servicio.id)
  if (servicioReactivado?.estado !== 'ACTIVO' || servicioReactivado.eliminacionProgramadaEn) {
    throw new Error('El servicio no pudo cancelar la eliminación y reactivarse')
  }
  cambiarEstadoServicio(servicio.id, 'INACTIVO')
  eliminarEmpleado(empleado.id)
  eliminarInsumo(insumo.id)
  if (
    listarServicios().some((item) => item.estado === 'ACTIVO') ||
    listarEmpleados().length ||
    listarInsumos().length
  ) {
    throw new Error('Los registros eliminados continúan en los catálogos activos')
  }

  const caja = obtenerResumenCaja()
  if (caja.ingresos !== 35 || caja.egresos !== 461 || caja.utilidad !== -426) {
    throw new Error(`Totales inesperados: ${JSON.stringify(caja)}`)
  }
  if (caja.movimientos.length !== 5) {
    throw new Error('El libro de caja debe contener exactamente cinco movimientos')
  }
  const cobroOrden = caja.movimientos.find(
    (movimiento) => movimiento.concepto === `Cobro de orden #${orden.id}`
  )
  if (cobroOrden?.metodoPago !== 'QR') {
    throw new Error(`Método de pago inesperado: ${JSON.stringify(cobroOrden)}`)
  }

  const historial = obtenerHistorialCliente(cliente.id)
  if (historial.visitas !== 1 || historial.totalGastado !== 10 || !historial.ultimaVisita) {
    throw new Error(`Historial de cliente inesperado: ${JSON.stringify(historial)}`)
  }

  const dashboard = obtenerDashboard()
  if (
    dashboard.autosAtendidosHoy !== 1 ||
    dashboard.facturacionHoy !== 10 ||
    dashboard.servicioMasVendido?.nombre !== 'Lavado funcional editado' ||
    dashboard.shampooConsumido?.cantidad !== 0.25
  ) {
    throw new Error(`Indicadores diarios inesperados: ${JSON.stringify(dashboard)}`)
  }

  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset()
  const localToday = new Date(today.getTime() - timezoneOffset * 60_000).toISOString().slice(0, 10)
  const reporte = obtenerReporte({ desde: localToday, hasta: localToday })
  if (
    reporte.autosAtendidos !== 1 ||
    reporte.facturacion !== 10 ||
    reporte.consumos[0]?.cantidad !== 0.25 ||
    reporte.ordenes.length !== 1
  ) {
    throw new Error(`Reporte inesperado: ${JSON.stringify(reporte)}`)
  }

  console.log('Flujo funcional correcto:', {
    ingresos: caja.ingresos,
    egresos: caja.egresos,
    utilidad: caja.utilidad
  })
} finally {
  closeDatabase()
  rmSync(path, { force: true })
}
