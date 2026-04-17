import { z } from "zod";

export const insumoSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(255, "El nombre es demasiado largo"),
  descripcion: z.string().optional(),
  categoria: z.string().min(1, "La categoría es obligatoria"),
  unidad_medida: z.string().min(1, "La unidad de medida es obligatoria"),
  stock_actual: z.coerce
    .number()
    .min(0, "El stock actual no puede ser negativo"),
  stock_minimo: z.coerce
    .number()
    .min(0, "El stock mínimo no puede ser negativo"),
  lote: z.string().optional(),
  fecha_vencimiento: z.string().optional(),
  proveedor: z.string().optional(),
  observaciones: z.string().optional(),
});