export interface PasswordRequirement {
  id: "length" | "uppercase" | "number" | "special";
  label: string;
  test: (password: string) => boolean;
}

// Mirrors the Joi pattern in `apps/api/src/validators/auth.validator.ts`
// (`newPassword`) — keep both in sync if the policy changes.
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: "length", label: "Mínimo 8 caracteres", test: (password) => password.length >= 8 },
  { id: "uppercase", label: "Una letra mayúscula", test: (password) => /[A-Z]/.test(password) },
  { id: "number", label: "Un número", test: (password) => /[0-9]/.test(password) },
  { id: "special", label: "Un carácter especial", test: (password) => /[^A-Za-z0-9]/.test(password) },
];

export function metRequirementCount(password: string): number {
  return PASSWORD_REQUIREMENTS.filter((requirement) => requirement.test(password)).length;
}
