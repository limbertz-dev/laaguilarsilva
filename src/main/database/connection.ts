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
  const vehicleColumns = db.prepare('PRAGMA table_info(vehiculos)').all() as unknown as {
    name: string
  }[]
  if (!vehicleColumns.some((column) => column.name === 'observaciones')) {
    db.exec("ALTER TABLE vehiculos ADD COLUMN observaciones TEXT NOT NULL DEFAULT ''")
  }

  const orderColumns = db.prepare('PRAGMA table_info(ordenes)').all() as unknown as {
    name: string
  }[]
  if (!orderColumns.some((column) => column.name === 'estado_operativo')) {
    db.exec("ALTER TABLE ordenes ADD COLUMN estado_operativo TEXT NOT NULL DEFAULT 'RECIBIDO'")
  }
  if (!orderColumns.some((column) => column.name === 'metodo_pago')) {
    db.exec("ALTER TABLE ordenes ADD COLUMN metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO'")
  }

  const movementColumns = db.prepare('PRAGMA table_info(movimientos_caja)').all() as unknown as {
    name: string
  }[]
  if (!movementColumns.some((column) => column.name === 'metodo_pago')) {
    db.exec('ALTER TABLE movimientos_caja ADD COLUMN metodo_pago TEXT')
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
