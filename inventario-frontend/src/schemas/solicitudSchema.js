import { z } from "zod";

export const solicitudSchema = z.object({
  tipo: z.enum(
    ["REPOSICION", "REPARACION", "BAJA", "TRASLADO", "ADQUISICION"],
    {
      errorMap: () => ({ message: "Seleccioná un tipo válido" }),
    }
  ),

  prioridad: z.enum(["BAJA", "MEDIA", "ALTA"], {
    errorMap: () => ({ message: "Seleccioná una prioridad válida" }),
  }),

  oficina_id: z
    .union([
      z.coerce.number().int("Seleccioná una oficina válida").min(1, {
        message: "Seleccioná una oficina válida",
      }),
      z.literal(""),
    ])
    .optional(),

  activo_id: z
    .union([
      z.coerce.number().int("Seleccioná un activo válido").min(1, {
        message: "Seleccioná un activo válido",
      }),
      z.literal(""),
    ])
    .optional(),

  descripcion: z
    .string()
    .trim()
    .min(5, {
      message:
        "La descripción es obligatoria y debe tener al menos 5 caracteres",
    })
    .max(1500, {
      message: "La descripción no puede superar los 1500 caracteres",
    }),
});