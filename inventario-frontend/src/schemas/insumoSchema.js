import { z } from "zod";

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""));

export const insumoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(255, "El nombre es demasiado largo"),

  categoria: z
    .string()
    .trim()
    .min(1, "La categoría es obligatoria")
    .max(120, "La categoría es demasiado larga"),

  unidad_medida: z
    .string()
    .trim()
    .min(1, "La unidad de medida es obligatoria")
    .max(80, "La unidad de medida es demasiado larga"),

  stock_actual: z.coerce
    .number({
      invalid_type_error: "El stock actual debe ser un número",
    })
    .min(0, "El stock actual no puede ser negativo"),

  stock_minimo: z.coerce
    .number({
      invalid_type_error: "El stock mínimo debe ser un número",
    })
    .min(0, "El stock mínimo no puede ser negativo"),

  proveedor: textoOpcional,

  activo: z.boolean().optional().default(true),
});