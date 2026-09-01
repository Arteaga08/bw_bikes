"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/use-toast";
import { changeAccountPassword } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

export interface PasswordFormProps {
  onClose: () => void;
}

interface FormErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function PasswordForm({ onClose }: PasswordFormProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!currentPassword) next.currentPassword = "La contraseña actual es obligatoria.";
    if (newPassword.length < 8) next.newPassword = "La nueva contraseña debe tener al menos 8 caracteres.";
    if (confirmPassword !== newPassword) next.confirmPassword = "Las contraseñas no coinciden.";
    return next;
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await changeAccountPassword(currentPassword, newPassword);
      toast({ variant: "success", title: "Contraseña actualizada. Cerramos tus otras sesiones." });
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && err.httpStatus === 401
          ? "La contraseña actual es incorrecta."
          : err instanceof ApiError
            ? err.message
            : "No se pudo actualizar la contraseña.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cambiar contraseña"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Input
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          error={errors.currentPassword}
        />
        <Input
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={errors.newPassword}
        />
        <Input
          label="Confirmar nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
        />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
