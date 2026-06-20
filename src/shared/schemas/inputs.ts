import { z } from 'zod'

const clean = (value: string): string => value.trim().replace(/\s+/g, ' ')
const texto = (label: string): z.ZodType<string, string> =>
  z.string({ error: `${label} es obligatorio` }).transform(clean)
const letras = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/
const dosDecimales = (value: number): boolean =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
const decimal = (label: string, min: number, max: number): z.ZodType<number, number> =>
  z
    .number({ error: `${label} debe ser un número válido` })
    .finite(`${label} debe ser un número válido`)
    .min(min, `${label} debe ser mayor o igual a ${min}`)
    .max(max, `${label} no puede superar ${max}`)
    .refine(dosDecimales, `${label} permite máximo 2 decimales`)

export const unidadesMedida = [
  'Litro',
  'Mililitro',
  'Unidad',
  'Kilogramo',
  'Gramo',
  'Paquete'
] as const
export const unidadesEnteras = new Set<string>(['Unidad', 'Paquete'])
export const tiposVehiculo = [
  'Automóvil',
  'Camioneta',
  'Vagoneta',
  'Moto',
  'Taxi',
  'Otro'
] as const
export const categoriasServicio = [
  'General',
  'Exterior',
  'Interior',
  'Completo',
  'Premium',
  'Motor',
  'Tapicería',
  'Pulido',
  'Adicional',
  'Promoción',
  'Otro'
] as const
export const categoriasCaja = [
  'Servicios',
  'Compra de insumos',
  'Salario',
  'Mantenimiento',
  'Alquiler',
  'Servicios básicos',
  'Gasto operativo',
  'Otro'
] as const
export const cargosEmpleado = [
  'Lavador',
  'Encargado',
  'Cajero',
  'Administrador',
  'Supervisor',
  'Otro'
] as const

export const clienteInput = z.object({
  nombre: texto('El nombre')
    .pipe(
      z
        .string()
        .min(3, 'El nombre debe tener al menos 3 caracteres')
        .max(80, 'El nombre no puede superar 80 caracteres')
    )
    .refine((value) => letras.test(value), 'El nombre solo puede contener letras y espacios'),
  telefono: texto('El teléfono').pipe(
    z.string().regex(/^\d{8}$/, 'El teléfono debe contener exactamente 8 dígitos')
  )
})

export const vehiculoInput = z.object({
  clienteId: z.number().int().positive('Debe seleccionar un cliente'),
  placa: texto('La placa')
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .min(3, 'La placa debe tener al menos 3 caracteres')
        .max(12, 'La placa no puede superar 12 caracteres')
        .regex(/^[A-Z0-9]+$/, 'La placa solo puede contener letras y números')
    ),
  marca: texto('La marca').pipe(
    z.string().min(1, 'La marca es obligatoria').max(40, 'La marca no puede superar 40 caracteres')
  ),
  modelo: texto('El modelo').pipe(
    z
      .string()
      .min(1, 'El modelo es obligatorio')
      .max(40, 'El modelo no puede superar 40 caracteres')
  ),
  color: texto('El color')
    .pipe(z.string().max(30, 'El color no puede superar 30 caracteres'))
    .default(''),
  tipo: z.enum(tiposVehiculo, { error: 'Debe seleccionar un tipo de vehículo' }),
  observaciones: texto('Las observaciones')
    .pipe(z.string().max(250, 'Las observaciones no pueden superar 250 caracteres'))
    .default('')
})

export const clienteConVehiculoInput = clienteInput.extend({
  vehiculo: vehiculoInput.omit({ clienteId: true }).optional()
})

export const servicioInput = z.object({
  nombre: texto('El nombre del servicio')
    .pipe(
      z
        .string()
        .min(3, 'El nombre debe tener al menos 3 caracteres')
        .max(60, 'El nombre no puede superar 60 caracteres')
    )
    .refine((value) => !/^\d+$/.test(value), 'El nombre no puede contener solo números'),
  descripcion: texto('La descripción')
    .pipe(z.string().max(250, 'La descripción no puede superar 250 caracteres'))
    .default(''),
  categoria: z.enum(categoriasServicio, { error: 'Debe seleccionar una categoría' }),
  precio: decimal('El precio', 1, 5000),
  insumos: z
    .array(
      z.object({
        insumoId: z.number().int().positive(),
        cantidad: decimal('La cantidad de insumo', 0, 100000)
      })
    )
    .default([])
})

export const reporteFiltroInput = z.object({
  desde: z.iso.date(),
  hasta: z.iso.date()
})

export const empleadoInput = z.object({
  nombres: texto('Los nombres')
    .pipe(
      z
        .string()
        .min(2, 'Los nombres deben tener al menos 2 caracteres')
        .max(50, 'Los nombres no pueden superar 50 caracteres')
    )
    .refine((value) => letras.test(value), 'Los nombres solo pueden contener letras y espacios'),
  apellidos: texto('Los apellidos')
    .pipe(
      z
        .string()
        .min(2, 'Los apellidos deben tener al menos 2 caracteres')
        .max(60, 'Los apellidos no pueden superar 60 caracteres')
    )
    .refine((value) => letras.test(value), 'Los apellidos solo pueden contener letras y espacios'),
  telefono: texto('El teléfono').pipe(
    z.string().regex(/^\d{8}$/, 'El teléfono debe contener exactamente 8 dígitos')
  ),
  cargo: z.enum(cargosEmpleado, { error: 'Debe seleccionar un cargo' }),
  salario: decimal('El salario', 0, 20000)
})

export const insumoInput = z
  .object({
    nombre: texto('El nombre del insumo')
      .pipe(
        z
          .string()
          .min(3, 'El nombre debe tener al menos 3 caracteres')
          .max(60, 'El nombre no puede superar 60 caracteres')
      )
      .refine((value) => !/^\d+$/.test(value), 'El nombre no puede contener solo números'),
    unidad: z.enum(unidadesMedida, { error: 'Debe seleccionar una unidad de medida' }),
    stockMinimo: decimal('El stock mínimo', 0, 100000)
  })
  .superRefine((data, context) => {
    if (unidadesEnteras.has(data.unidad) && !Number.isInteger(data.stockMinimo)) {
      context.addIssue({
        code: 'custom',
        path: ['stockMinimo'],
        message: `El stock mínimo en ${data.unidad} debe ser entero`
      })
    }
  })

export const insumoUpdateInput = insumoInput

export const compraInsumoInput = z.object({
  insumoId: z.number().int().positive('Debe seleccionar un insumo'),
  cantidad: decimal('La cantidad', 0.01, 100000),
  costoUnitario: decimal('El costo unitario', 0.01, 100000)
})

export const ordenInput = z.object({
  vehiculoId: z.number().int().positive(),
  empleadoId: z.number().int().positive(),
  servicioIds: z.array(z.number().int().positive()).min(1),
  descuento: decimal('El descuento', 0, 5000).default(0),
  metodoPago: z.enum(['EFECTIVO', 'QR', 'TRANSFERENCIA'])
})

export const egresoInput = z.object({
  categoria: texto('La categoría').pipe(
    z
      .string()
      .min(3, 'La categoría debe tener al menos 3 caracteres')
      .max(50, 'La categoría no puede superar 50 caracteres')
  ),
  concepto: texto('El concepto')
    .pipe(
      z
        .string()
        .min(5, 'El concepto debe tener al menos 5 caracteres')
        .max(120, 'El concepto no puede superar 120 caracteres')
    )
    .refine((value) => !/^\d+$/.test(value), 'El concepto no puede contener solo números'),
  monto: decimal('El monto', 1, 100000)
})

export const movimientoManualInput = egresoInput.extend({
  tipo: z.enum(['INGRESO', 'EGRESO'])
})

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Datos inválidos')
  return result.data
}

export type ClienteInput = z.input<typeof clienteInput>
export type ClienteConVehiculoInput = z.input<typeof clienteConVehiculoInput>
export type VehiculoInput = z.input<typeof vehiculoInput>
export type ServicioInput = z.input<typeof servicioInput>
export type EmpleadoInput = z.input<typeof empleadoInput>
export type InsumoInput = z.input<typeof insumoInput>
export type InsumoUpdateInput = z.input<typeof insumoUpdateInput>
export type CompraInsumoInput = z.input<typeof compraInsumoInput>
export type OrdenInput = z.input<typeof ordenInput>
export type EgresoInput = z.input<typeof egresoInput>
export type MovimientoManualInput = z.input<typeof movimientoManualInput>
export type ReporteFiltroInput = z.input<typeof reporteFiltroInput>
