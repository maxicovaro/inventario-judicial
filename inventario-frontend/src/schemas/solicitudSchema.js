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
  activo_id: z.union([z.coerce.number().min(1), z.literal("")]).optional(),
  descripcion: z.string().optional(),
});