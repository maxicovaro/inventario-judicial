import { z } from "zod";

export const usuarioSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es obligatorio"),
    apellido: z.string().min(1, "El apellido es obligatorio"),
    email: z
      .string()
      .min(1, "El email es obligatorio")
      .email("Email inválido"),
    password: z.string(),
    confirmPassword: z.string(),
    role_id: z.coerce.number().min(1, "El rol es obligatorio"),
    oficina_id: z.coerce.number().min(1, "La oficina es obligatoria"),
    activo: z.boolean().default(true),
    esEdicion: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const password = data.password?.trim() || "";
    const confirmPassword = data.confirmPassword?.trim() || "";
    const esEdicion = Boolean(data.esEdicion);

    if (!esEdicion) {
      if (password.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "La contraseña debe tener al menos 6 caracteres",
        });
      }

      if (confirmPassword.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: "Confirmá la contraseña",
        });
      }
    }

    if (esEdicion && password.length > 0 && password.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: "Las contraseñas no coinciden",
        });
      }
    }
  });