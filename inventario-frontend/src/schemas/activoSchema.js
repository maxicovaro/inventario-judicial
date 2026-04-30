import { z } from "zod";

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""));

export const activoSchema = z.object({
  codigo_interno: textoOpcional,

  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(255, "El nombre es demasiado largo"),

  descripcion: textoOpcional,

  marca: textoOpcional,

  modelo: textoOpcional,

  numero_serie: textoOpcional,

  cantidad: z.coerce
    .number({
      invalid_type_error: "La cantidad debe ser un número",
    })
    .min(1, "La cantidad debe ser al menos 1"),

  estado: z.enum(
    [
      "Excelente estado",
      "Buen estado",
      "Regular estado",
      "Mal estado",
      "Sin funcionar",
      "Dado de baja",
    ],
    {
      errorMap: () => ({ message: "Seleccioná un estado válido" }),
    }
  ),

  fecha_alta: z.string().optional().or(z.literal("")),

  observaciones: textoOpcional,

  categoria_id: z.coerce
    .number({
      invalid_type_error: "La categoría es obligatoria",
    })
    .min(1, "La categoría es obligatoria"),

  oficina_id: z.coerce
    .number({
      invalid_type_error: "La oficina es obligatoria",
    })
    .min(1, "La oficina es obligatoria"),
});