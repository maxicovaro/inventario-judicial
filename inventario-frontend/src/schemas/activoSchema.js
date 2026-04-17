import { z } from "zod";

export const activoSchema = z.object({
  codigo_interno: z.string().optional(),
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(255, "El nombre es demasiado largo"),
  descripcion: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  cantidad: z.coerce
    .number()
    .min(1, "La cantidad debe ser al menos 1"),
  estado: z.enum([
    "Excelente estado",
    "Buen estado",
    "Regular estado",
    "Mal estado",
    "Sin funcionar",
    "Dado de baja",
  ], {
    errorMap: () => ({ message: "Seleccioná un estado válido" }),
  }),
  fecha_alta: z.string().optional(),
  observaciones: z.string().optional(),
  categoria_id: z.coerce
    .number()
    .min(1, "La categoría es obligatoria"),
  oficina_id: z.coerce
    .number()
    .min(1, "La oficina es obligatoria"),
});