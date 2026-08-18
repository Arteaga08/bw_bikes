import { Resend } from "resend";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/index.js";
import { renderTransactionalEmail } from "./email-template.js";
import type { Mailer } from "./mailer.interface.js";

/**
 * The only module in the codebase that imports the Resend SDK — mirrors
 * `stripe.provider.ts`/`storage.service.ts`: business code depends on
 * `Mailer`, never on this SDK directly.
 *
 * Only reachable through `createMailer()` (`index.ts`), which already gates
 * on `env.isResendConfigured` — this adapter never checks it itself.
 *
 * Unlike `telegram.notifier.ts`, this one **throws** on failure instead of
 * logging and swallowing: `auth.service.ts` awaits both `sendVerificationEmail`
 * and `sendPasswordResetEmail` directly, with no `.catch()` of its own — a
 * registration or reset that silently didn't deliver its email would leave
 * the account permanently unreachable, which is worse than the request
 * itself failing with a clear error the client can retry.
 */
let client: Resend | undefined;

function resendClient(): Resend {
  client ??= new Resend(env.resendApiKey);
  return client;
}

async function send(params: { to: string; subject: string; html: string }): Promise<void> {
  const { error } = await resendClient().emails.send({
    from: env.mailFrom,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new AppError("No se pudo enviar el correo. Intenta de nuevo más tarde.", 502);
  }
}

export const resendMailer: Mailer = {
  async sendVerificationEmail({ to, firstName, verifyUrl }) {
    await send({
      to,
      subject: "Confirma tu correo — Black & White Bikes",
      html: renderTransactionalEmail({
        preheader: "Confirma tu correo para activar tu cuenta.",
        greetingName: firstName,
        bodyParagraphs: ["Gracias por registrarte en Black & White Bikes. Confirma tu correo para activar tu cuenta:"],
        ctaLabel: "Confirmar mi correo",
        ctaUrl: verifyUrl,
        disclaimer: "Si tú no creaste esta cuenta, puedes ignorar este mensaje.",
      }),
    });
  },

  async sendPasswordResetEmail({ to, firstName, resetUrl }) {
    await send({
      to,
      subject: "Restablece tu contraseña — Black & White Bikes",
      html: renderTransactionalEmail({
        preheader: "Restablece tu contraseña de Black & White Bikes.",
        greetingName: firstName,
        bodyParagraphs: ["Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, usa este botón:"],
        ctaLabel: "Restablecer contraseña",
        ctaUrl: resetUrl,
        disclaimer: "Si tú no la solicitaste, puedes ignorar este mensaje — tu contraseña actual sigue siendo válida.",
      }),
    });
  },

  async sendShipmentNotification({ to, firstName, orderNumber, carrierName, trackingNumber, trackingUrl }) {
    await send({
      to,
      subject: `Tu pedido ${orderNumber} va en camino — Black & White Bikes`,
      html: renderTransactionalEmail({
        preheader: `${carrierName} · guía ${trackingNumber}`,
        greetingName: firstName,
        bodyParagraphs: [
          `Tu pedido <strong>${orderNumber}</strong> salió de nuestro almacén con ${carrierName}.`,
          `Número de guía: <strong>${trackingNumber}</strong>`,
        ],
        ctaLabel: "Rastrear mi pedido",
        ctaUrl: trackingUrl,
        disclaimer: "Si tienes dudas sobre tu pedido, responde este correo o contáctanos.",
      }),
    });
  },
};
