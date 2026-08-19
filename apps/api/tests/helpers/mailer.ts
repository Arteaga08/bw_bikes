import { vi } from "vitest";
import { stubMailer } from "../../src/services/mailer/stub.mailer.js";

/**
 * `stubMailer` is a module-level singleton — `createMailer()` (used by
 * `auth.service.ts`) always returns this exact object, so spying on its
 * methods here intercepts whatever the service under test "sends" without
 * touching any production code. Restored globally in `tests/setup.ts`'s
 * `afterEach` via `vi.restoreAllMocks()`.
 */
export function captureNextVerificationLink(): { getUrl: () => string } {
  let url = "";
  vi.spyOn(stubMailer, "sendVerificationEmail").mockImplementationOnce(async (params) => {
    url = params.verifyUrl;
  });
  return { getUrl: () => url };
}

export function captureNextResetLink(): { getUrl: () => string } {
  let url = "";
  vi.spyOn(stubMailer, "sendPasswordResetEmail").mockImplementationOnce(async (params) => {
    url = params.resetUrl;
  });
  return { getUrl: () => url };
}

export function captureNextShipmentNotification(): {
  getParams: () => Parameters<typeof stubMailer.sendShipmentNotification>[0] | undefined;
} {
  let params: Parameters<typeof stubMailer.sendShipmentNotification>[0] | undefined;
  vi.spyOn(stubMailer, "sendShipmentNotification").mockImplementationOnce(async (input) => {
    params = input;
  });
  return { getParams: () => params };
}

export function captureNextOrderPaidEmail(): {
  getParams: () => Parameters<typeof stubMailer.sendOrderPaidEmail>[0] | undefined;
} {
  let params: Parameters<typeof stubMailer.sendOrderPaidEmail>[0] | undefined;
  vi.spyOn(stubMailer, "sendOrderPaidEmail").mockImplementationOnce(async (input) => {
    params = input;
  });
  return { getParams: () => params };
}

export function captureNextOrderProcessingEmail(): {
  getParams: () => Parameters<typeof stubMailer.sendOrderProcessingEmail>[0] | undefined;
} {
  let params: Parameters<typeof stubMailer.sendOrderProcessingEmail>[0] | undefined;
  vi.spyOn(stubMailer, "sendOrderProcessingEmail").mockImplementationOnce(async (input) => {
    params = input;
  });
  return { getParams: () => params };
}

export function captureNextOrderDeliveredEmail(): {
  getParams: () => Parameters<typeof stubMailer.sendOrderDeliveredEmail>[0] | undefined;
} {
  let params: Parameters<typeof stubMailer.sendOrderDeliveredEmail>[0] | undefined;
  vi.spyOn(stubMailer, "sendOrderDeliveredEmail").mockImplementationOnce(async (input) => {
    params = input;
  });
  return { getParams: () => params };
}

export function captureNextRefundConfirmedEmail(): {
  getParams: () => Parameters<typeof stubMailer.sendRefundConfirmedEmail>[0] | undefined;
} {
  let params: Parameters<typeof stubMailer.sendRefundConfirmedEmail>[0] | undefined;
  vi.spyOn(stubMailer, "sendRefundConfirmedEmail").mockImplementationOnce(async (input) => {
    params = input;
  });
  return { getParams: () => params };
}

export function captureNextPaymentFailedEmail(): {
  getParams: () => Parameters<typeof stubMailer.sendPaymentFailedEmail>[0] | undefined;
} {
  let params: Parameters<typeof stubMailer.sendPaymentFailedEmail>[0] | undefined;
  vi.spyOn(stubMailer, "sendPaymentFailedEmail").mockImplementationOnce(async (input) => {
    params = input;
  });
  return { getParams: () => params };
}

export function captureNextAdminAlertEmail(): {
  getParams: () => Parameters<typeof stubMailer.sendAdminAlertEmail>[0] | undefined;
} {
  let params: Parameters<typeof stubMailer.sendAdminAlertEmail>[0] | undefined;
  vi.spyOn(stubMailer, "sendAdminAlertEmail").mockImplementationOnce(async (input) => {
    params = input;
  });
  return { getParams: () => params };
}

/** Pulls the `token` query param out of a link produced by the above. */
export function extractToken(url: string): string {
  const token = new URL(url).searchParams.get("token");
  if (!token) throw new Error(`No token query param found in captured link: ${url}`);
  return token;
}
