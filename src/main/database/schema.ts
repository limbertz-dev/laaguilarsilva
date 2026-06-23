export const schemaSql = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  eliminacion_programada_en TEXT
);

CREATE TABLE IF NOT EXISTS insumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  unidad TEXT NOT NULL,
  stock_actual REAL NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo REAL NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
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
  observaciones TEXT NOT NULL DEFAULT '',
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
  origen_id INTEGER,
  UNIQUE (origen, origen_id)
);

CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_caja(fecha);
CREATE INDEX IF NOT EXISTS idx_consumos_fecha ON consumos_insumo(fecha);
`
