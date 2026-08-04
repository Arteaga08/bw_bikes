import type { UserRole } from "@bw-bikes/shared";

// Populated by `protect`. Deliberately minimal — just enough for
// `restrictTo` and ownership checks; anything else a route needs it loads
// itself via the id.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

export {};
