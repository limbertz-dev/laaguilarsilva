import type { Database as SqlJsDatabase } from 'sql.js'
import initSqlJs from 'sql.js'

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null
let db: SqlJsDatabase | null = null

export function toCents(value: number): number {
  return Math.round(value * 100)
}

export function fromCents(value: unknown): number {
  return Number(value) / 100
}

export function toId(value: number | bigint): number {
  return Number(value)
}

export interface DBResult {
  lastInsertRowid: number
  changes: number
}

function loadWasmBinary(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onload = (): void => {
      if (xhr.status === 0 || xhr.status === 200) {
        resolve(xhr.response as ArrayBuffer)
      } else {
        reject(new Error(`HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = (): void => reject(new Error(`Error al cargar ${url}`))
    xhr.send()
  })
}

export async function initDatabase(): Promise<void> {
  if (db) return
  const wasmBinary = await loadWasmBinary('./sql-wasm.wasm')
  SQL = await initSqlJs({ wasmBinary })
  db = new SQL.Database()
  db.run(schemaSql)
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Base de datos no inicializada')
  return db
}

export function all<T = Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
): T[] {
  const stmt = getDb().prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function get<T = Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
): T | undefined {
  const stmt = getDb().prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const hasRow = stmt.step()
  const row = hasRow ? (stmt.getAsObject() as T) : undefined
  stmt.free()
  return row
}

export function run(sql: string, ...params: unknown[]): DBResult {
  getDb().run(sql, params)
  const lastRow = get<{ id: number }>('SELECT last_insert_rowid() AS id')
  const changesRow = get<{ count: number }>('SELECT changes() AS count')
  return { lastInsertRowid: lastRow?.id ?? 0, changes: changesRow?.count ?? 0 }
}

export function transaction<T>(operation: () => T): T {
  getDb().run('BEGIN IMMEDIATE')
  try {
    const result = operation()
    getDb().run('COMMIT')
    return result
  } catch (error) {
    getDb().run('ROLLBACK')
    throw error
  }
}

const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  eliminacion_programada_en TEXT
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  placa TEXT NOT NULL UNIQUE,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  eliminacion_programada_en TEXT
);

CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT 'General',
  precio_centavos INTEGER NOT NULL CHECK (precio_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  eliminacion_programada_en TEXT
);

CREATE TABLE IF NOT EXISTS empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  telefono TEXT NOT NULL,
  cargo TEXT NOT NULL,
  salario_centavos INTEGER NOT NULL CHECK (salario_centavos >= 0),
  tipo_pago TEXT NOT NULL DEFAULT 'Mes',
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  eliminacion_programada_en TEXT
);

CREATE TABLE IF NOT EXISTS insumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  tipo_paquete TEXT NOT NULL,
  contenido TEXT NOT NULL DEFAULT '',
  paquetes INTEGER NOT NULL DEFAULT 0 CHECK (paquetes >= 0),
  paquetes_minimo INTEGER NOT NULL DEFAULT 0 CHECK (paquetes_minimo >= 0),
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  eliminacion_programada_en TEXT
);

CREATE TABLE IF NOT EXISTS ordenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
  empleado_id INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
  subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  descuento_centavos INTEGER NOT NULL DEFAULT 0 CHECK (descuento_centavos >= 0),
  total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'COMPLETADA', 'CANCELADA')),
  estado_operativo TEXT NOT NULL DEFAULT 'RECIBIDO',
  metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO',
  fecha_ingreso TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_completada TEXT
);

CREATE TABLE IF NOT EXISTS orden_servicios (
  orden_id INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  precio_centavos INTEGER NOT NULL,
  PRIMARY KEY (orden_id, servicio_id)
);

CREATE TABLE IF NOT EXISTS servicio_insumos (
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (servicio_id, insumo_id)
);

CREATE TABLE IF NOT EXISTS consumos_insumo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (orden_id, servicio_id, insumo_id)
);

CREATE TABLE IF NOT EXISTS compras_insumo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  costo_unitario_centavos INTEGER NOT NULL CHECK (costo_unitario_centavos >= 0),
  total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
  fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
  categoria TEXT NOT NULL,
  concepto TEXT NOT NULL,
  monto_centavos INTEGER NOT NULL CHECK (monto_centavos > 0),
  metodo_pago TEXT,
  origen TEXT NOT NULL,
  origen_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_caja(fecha);
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_origen ON movimientos_caja(origen, origen_id) WHERE origen != 'PAGO_SALARIO';
CREATE INDEX IF NOT EXISTS idx_consumos_fecha ON consumos_insumo(fecha);
`
