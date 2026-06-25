import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { schemaSql } from './schema'

let database: DatabaseSync | null = null

export function getDatabase(): DatabaseSync {
  if (!database) throw new Error('La base de datos todavía no fue inicializada')
  return database
}

export function initializeDatabase(databasePath?: string): DatabaseSync {
  if (database) return database
  const path = databasePath ?? join(app.getPath('userData'), 'laaguilarsilva.sqlite')
  database = new DatabaseSync(path)
  database.exec(schemaSql)
  migrateDatabase(database)
  return database
}

function migrateDatabase(db: DatabaseSync): void {
  const serviceColumns = db.prepare('PRAGMA table_info(servicios)').all() as unknown as {
    name: string
  }[]
  if (!serviceColumns.some((column) => column.name === 'eliminacion_programada_en')) {
    db.exec('ALTER TABLE servicios ADD COLUMN eliminacion_programada_en TEXT')
  }

  const clientColumns = db.prepare('PRAGMA table_info(clientes)').all() as unknown as {
    name: string
  }[]
  if (!clientColumns.some((column) => column.name === 'eliminacion_programada_en')) {
    db.exec('ALTER TABLE clientes ADD COLUMN eliminacion_programada_en TEXT')
  }
  if (!clientColumns.some((column) => column.name === 'estado')) {
    db.exec("ALTER TABLE clientes ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO'))")
  }

  const vehicleColumns = db.prepare('PRAGMA table_info(vehiculos)').all() as unknown as {
    name: string
  }[]
  if (!vehicleColumns.some((column) => column.name === 'observaciones')) {
    db.exec("ALTER TABLE vehiculos ADD COLUMN observaciones TEXT NOT NULL DEFAULT ''")
  }
  if (!vehicleColumns.some((column) => column.name === 'eliminacion_programada_en')) {
    db.exec('ALTER TABLE vehiculos ADD COLUMN eliminacion_programada_en TEXT')
  }
  if (!vehicleColumns.some((column) => column.name === 'estado')) {
    db.exec("ALTER TABLE vehiculos ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO'))")
  }

  const employeeColumns = db.prepare('PRAGMA table_info(empleados)').all() as unknown as {
    name: string
  }[]
  if (!employeeColumns.some((column) => column.name === 'eliminacion_programada_en')) {
    db.exec('ALTER TABLE empleados ADD COLUMN eliminacion_programada_en TEXT')
  }
  if (!employeeColumns.some((column) => column.name === 'tipo_pago')) {
    db.exec("ALTER TABLE empleados ADD COLUMN tipo_pago TEXT NOT NULL DEFAULT 'Mes'")
  }

  const supplyColumns = db.prepare('PRAGMA table_info(insumos)').all() as unknown as {
    name: string
  }[]
  if (!supplyColumns.some((column) => column.name === 'eliminacion_programada_en')) {
    db.exec('ALTER TABLE insumos ADD COLUMN eliminacion_programada_en TEXT')
  }
  if (!supplyColumns.some((column) => column.name === 'tipo_paquete')) {
    db.exec(`
      ALTER TABLE insumos ADD COLUMN tipo_paquete TEXT NOT NULL DEFAULT 'Paquete';
      ALTER TABLE insumos ADD COLUMN contenido TEXT NOT NULL DEFAULT '';
      ALTER TABLE insumos ADD COLUMN paquetes INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE insumos ADD COLUMN paquetes_minimo INTEGER NOT NULL DEFAULT 0;
    `)
    if (supplyColumns.some((column) => column.name === 'unidad')) {
      db.exec(`
        UPDATE insumos
        SET tipo_paquete = CASE
              WHEN unidad IN ('Paquete', 'Unidad') THEN 'Paquete'
              WHEN unidad IN ('Litro', 'Mililitro') THEN 'Botella'
              WHEN unidad IN ('Kilogramo', 'Gramo') THEN 'Bolsa'
              ELSE 'Otro'
            END,
            contenido = CASE
              WHEN trim(contenido) = '' THEN unidad
              ELSE contenido
            END,
            paquetes = CAST(ROUND(COALESCE(stock_actual, 0)) AS INTEGER),
            paquetes_minimo = CAST(ROUND(COALESCE(stock_minimo, 0)) AS INTEGER)
      `)
    }
  }

  const orderColumns = db.prepare('PRAGMA table_info(ordenes)').all() as unknown as {
    name: string
    notnull: number
  }[]
  if (!orderColumns.some((column) => column.name === 'estado_operativo')) {
    db.exec("ALTER TABLE ordenes ADD COLUMN estado_operativo TEXT NOT NULL DEFAULT 'RECIBIDO'")
  }
  if (!orderColumns.some((column) => column.name === 'metodo_pago')) {
    db.exec("ALTER TABLE ordenes ADD COLUMN metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO'")
  }
  const employeeColumn = orderColumns.find((column) => column.name === 'empleado_id')
  if (employeeColumn?.notnull === 1) {
    db.exec('PRAGMA foreign_keys = OFF')
    try {
      db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE ordenes_migracion (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE RESTRICT,
          empleado_id INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
          subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
          descuento_centavos INTEGER NOT NULL DEFAULT 0 CHECK (descuento_centavos >= 0),
          total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
          estado TEXT NOT NULL DEFAULT 'PENDIENTE'
            CHECK (estado IN ('PENDIENTE', 'COMPLETADA', 'CANCELADA')),
          estado_operativo TEXT NOT NULL DEFAULT 'RECIBIDO',
          metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO',
          fecha_ingreso TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          fecha_completada TEXT
        );
        INSERT INTO ordenes_migracion (
          id, vehiculo_id, empleado_id, subtotal_centavos, descuento_centavos,
          total_centavos, estado, estado_operativo, metodo_pago,
          fecha_ingreso, fecha_completada
        )
        SELECT
          id, vehiculo_id, empleado_id, subtotal_centavos, descuento_centavos,
          total_centavos, estado, estado_operativo, metodo_pago,
          fecha_ingreso, fecha_completada
        FROM ordenes;
        DROP TABLE ordenes;
        ALTER TABLE ordenes_migracion RENAME TO ordenes;
        CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
        COMMIT;
      `)
    } catch (error) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // The migration script may have rolled back before reaching an active transaction.
      }
      throw error
    } finally {
      db.exec('PRAGMA foreign_keys = ON')
    }
  }

  const movementColumns = db.prepare('PRAGMA table_info(movimientos_caja)').all() as unknown as {
    name: string
  }[]
  if (!movementColumns.some((column) => column.name === 'metodo_pago')) {
    db.exec('ALTER TABLE movimientos_caja ADD COLUMN metodo_pago TEXT')
  }

  const movementIndex = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_movimientos_origen'"
  ).get() as { name: string } | undefined
  if (!movementIndex) {
    db.exec('PRAGMA foreign_keys = OFF')
    try {
      db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE movimientos_caja_migracion (
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
        INSERT INTO movimientos_caja_migracion (id, fecha, tipo, categoria, concepto, monto_centavos, metodo_pago, origen, origen_id)
          SELECT id, fecha, tipo, categoria, concepto, monto_centavos, metodo_pago, origen, origen_id FROM movimientos_caja;
        DROP TABLE movimientos_caja;
        ALTER TABLE movimientos_caja_migracion RENAME TO movimientos_caja;
        CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_caja(fecha);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_origen ON movimientos_caja(origen, origen_id) WHERE origen != 'PAGO_SALARIO';
        COMMIT;
      `)
    } catch (error) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // May have rolled back before reaching an active transaction
      }
      throw error
    } finally {
      db.exec('PRAGMA foreign_keys = ON')
    }
  }

  db.exec(`
    UPDATE ordenes
    SET estado_operativo = CASE
      WHEN estado = 'COMPLETADA' THEN 'ENTREGADO'
      WHEN estado = 'CANCELADA' THEN 'CANCELADO'
      ELSE COALESCE(NULLIF(estado_operativo, ''), 'RECIBIDO')
    END
  `)
}

export function closeDatabase(): void {
  database?.close()
  database = null
}

export function transaction<T>(operation: () => T): T {
  const db = getDatabase()
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = operation()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
