"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LOGIN_PATH } from "@/lib/config";

/**
 * The only interactive bit of `/admin/sin-acceso` — kept as its own island
 * (FRONTEND_GUIDELINES.md §1) instead of making the whole page a Client
 * Component, and as a `<button onClick>` instead of nesting the shared
 * `<Button>` inside a `<Link>` (which would nest two interactive elements).
 */
export function GoToLoginButton() {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={() => router.push(LOGIN_PATH)}>
      Ir a iniciar sesión
    </Button>
  );
}
