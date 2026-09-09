import { z } from "zod";

const passwordValida = (password) =>
  password.length >= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const passwordMessage =
  "La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo";

export const usuarioSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es obligatorio"),
    apellido: z.string().min(1, "El apellido es obligatorio"),
    email: z.string().min(1, "El email es obligatorio").email("Email inválido"),
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

    if (!esEdicion && !passwordValida(password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: passwordMessage,
      });
    }

    if (!esEdicion && !passwordValida(confirmPassword)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Confirmá una contraseña que cumpla la política de seguridad",
      });
    }

    if (esEdicion && password.length > 0 && !passwordValida(password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: passwordMessage,
      });
    }

    if ((password || confirmPassword) && password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden",
      });
    }
  });