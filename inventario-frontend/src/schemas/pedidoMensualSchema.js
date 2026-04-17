import { z } from "zod";

export const pedidoMensualSchema = z.object({
  mes: z.coerce
    .number()
    .min(1, "El mes debe ser mayor o igual a 1")
    .max(12, "El mes debe ser menor o igual a 12"),
  anio: z.coerce
    .number()
    .min(2020, "El año no es válido")
    .max(2100, "El año no es válido"),
  cantidad_hechos_delictivos: z.coerce
    .number()
    .min(0, "No puede ser negativo"),
  cantidad_autopsias: z.coerce
    .number()
    .min(0, "No puede ser negativo"),
  observaciones: z.string().optional(),
});