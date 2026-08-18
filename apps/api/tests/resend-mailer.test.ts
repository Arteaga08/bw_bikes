import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-level test for `resendMailer` itself — every other suite drives
 * verification/reset through `tests/helpers/mailer.ts`'s spies on
 * `stubMailer`, which never exercises what this adapter actually sends to
 * the Resend SDK. This file mocks one layer lower, at the `resend` package
 * boundary (same technique as `tests/stripe-provider.test.ts`), so the shape
 * of the real `emails.send()` call is what gets asserted.
 */

vi.mock("../src/config/env.js", () => ({
  env: {
    isProduction: false,
    resendApiKey: "re_test_fixture",
    mailFrom: "BW Bikes <onboarding@resend.dev>",
  },
}));

const sendMock = vi.fn();

vi.mock("resend", () => {
  class FakeResend {
    emails = { send: sendMock };
    constructor(public apiKey: string) {}
  }
  return { Resend: FakeResend };
});

describe("resendMailer", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("sends the verification email from MAIL_FROM with the verify link in the body", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_1" }, error: null });

    const { resendMailer } = await import("../src/services/mailer/resend.mailer.js");
    await resendMailer.sendVerificationEmail({
      to: "ana@example.com",
      firstName: "Ana",
      verifyUrl: "https://bnwbikes.com/verify-email?token=abc",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload] = sendMock.mock.calls[0] as [{ from: string; to: string; subject: string; html: string }];
    expect(payload.from).toBe("BW Bikes <onboarding@resend.dev>");
    expect(payload.to).toBe("ana@example.com");
    expect(payload.subject).toContain("Confirma tu correo");
    expect(payload.html).toContain("https://bnwbikes.com/verify-email?token=abc");
  });

  it("sends the password reset email with the reset link in the body", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_2" }, error: null });

    const { resendMailer } = await import("../src/services/mailer/resend.mailer.js");
    await resendMailer.sendPasswordResetEmail({
      to: "ana@example.com",
      firstName: "Ana",
      resetUrl: "https://bnwbikes.com/reset-password?token=xyz",
    });

    const [payload] = sendMock.mock.calls.at(-1) as [{ subject: string; html: string }];
    expect(payload.subject).toContain("Restablece tu contraseña");
    expect(payload.html).toContain("https://bnwbikes.com/reset-password?token=xyz");
  });

  it("throws instead of resolving silently when Resend reports an error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: "validation_error", message: "invalid `to` field" } });

    const { resendMailer } = await import("../src/services/mailer/resend.mailer.js");
    await expect(
      resendMailer.sendVerificationEmail({ to: "bad", firstName: "Ana", verifyUrl: "https://x" }),
    ).rejects.toThrow("No se pudo enviar el correo");
  });
});
