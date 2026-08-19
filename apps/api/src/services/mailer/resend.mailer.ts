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

  async sendShipmentNotification({ to, firstName, orderNumber, carrierName, trackingNumber, trackingUrl, lines }) {
    const productLines = lines
      .map((line) => {
        const variant = [line.size ? `talla ${line.size}` : undefined, line.color].filter(Boolean).join(" · ");
        return `${line.qty}× ${line.name}${variant ? ` (${variant})` : ""}`;
      })
      .join("<br />");

    await send({
      to,
      subject: `Tu pedido ${orderNumber} va en camino — Black & White Bikes`,
      html: renderTransactionalEmail({
        preheader: `${carrierName} · guía ${trackingNumber}`,
        greetingName: firstName,
        bodyParagraphs: [
          `Tu pedido <strong>${orderNumber}</strong> salió de nuestro almacén con ${carrierName}.`,
          `Número de guía: <strong>${trackingNumber}</strong>`,
          `<strong>Resumen de tu pedido:</strong><br />${productLines}`,
        ],
        ctaLabel: "Rastrear mi pedido",
        ctaUrl: trackingUrl,
        disclaimer: "Si tienes dudas sobre tu pedido, responde este correo o contáctanos.",
      }),
    });
  },

  async sendOrderPaidEmail({ to, firstName, orderNumber, totalCents }) {
    await send({
      to,
      subject: `Pago confirmado — pedido ${orderNumber} — Black & White Bikes`,
      html: renderTransactionalEmail({
        preheader: `Recibimos tu pago de $${(totalCents / 100).toFixed(2)} MXN.`,
        greetingName: firstName,
        bodyParagraphs: [
          `Tu pago del pedido <strong>${orderNumber}</strong> por $${(totalCents / 100).toFixed(2)} MXN fue confirmado.`,
          "Ya estamos preparando tu pedido — te avisaremos en cuanto salga rumbo a ti.",
        ],
        ctaLabel: "Ver mi pedido",
        ctaUrl: `${env.clientUrl}/pedidos/${orderNumber}`,
        disclaimer: "Si tienes dudas sobre tu pedido, responde este correo o contáctanos.",
      }),
    });
  },

  async sendOrderProcessingEmail({ to, firstName, orderNumber }) {
    await send({
      to,
      subject: `Estamos preparando tu pedido ${orderNumber} — Black & White Bikes`,
      html: renderTransactionalEmail({
        preheader: "Tu pedido ya está en preparación.",
        greetingName: firstName,
        bodyParagraphs: [
          `Tu pedido <strong>${orderNumber}</strong> ya está en preparación en nuestro almacén.`,
          "En cuanto salga rumbo a ti te enviaremos el número de guía.",
        ],
        ctaLabel: "Ver mi pedido",
        ctaUrl: `${env.clientUrl}/pedidos/${orderNumber}`,
        disclaimer: "Si tienes dudas sobre tu pedido, responde este correo o contáctanos.",
      }),
    });
  },

  async sendOrderDeliveredEmail({ to, firstName, orderNumber }) {
    await send({
      to,
      subject: `Tu pedido ${orderNumber} fue entregado — Black & White Bikes`,
      html: renderTransactionalEmail({
        preheader: "Tu pedido llegó a su destino.",
        greetingName: firstName,
        bodyParagraphs: [
          `Tu pedido <strong>${orderNumber}</strong> fue entregado. ¡Esperamos que lo disfrutes!`,
          "Si algo no llegó como esperabas, responde este correo o contáctanos.",
        ],
        ctaLabel: "Ver mi pedido",
        ctaUrl: `${env.clientUrl}/pedidos/${orderNumber}`,
        disclaimer: "Si tienes dudas sobre tu pedido, responde este correo o contáctanos.",
      }),
    });
  },

  async sendRefundConfirmedEmail({ to, firstName, orderNumber, refundedAmountCents }) {
    await send({
      to,
      subject: `Reembolso confirmado — pedido ${orderNumber} — Black & White Bikes`,
      html: renderTransactionalEmail({
        preheader: `Reembolsamos $${(refundedAmountCents / 100).toFixed(2)} MXN.`,
        greetingName: firstName,
        bodyParagraphs: [
          `Confirmamos el reembolso de $${(refundedAmountCents / 100).toFixed(2)} MXN por tu pedido <strong>${orderNumber}</strong>.`,
          "El monto puede tardar unos días hábiles en reflejarse en tu banco, según el emisor de tu tarjeta.",
        ],
        ctaLabel: "Ver mi pedido",
        ctaUrl: `${env.clientUrl}/pedidos/${orderNumber}`,
        disclaimer: "Si tienes dudas sobre este reembolso, responde este correo o contáctanos.",
      }),
    });
  },

  async sendPaymentFailedEmail({ to, firstName, orderNumber }) {
    await send({
      to,
      subject: `No pudimos procesar tu pago — pedido ${orderNumber} — Black & White Bikes`,
      html: renderTransactionalEmail({
        preheader: "Tu intento de pago no se pudo completar.",
        greetingName: firstName,
        bodyParagraphs: [
          `No pudimos procesar el pago de tu pedido <strong>${orderNumber}</strong>. No se realizó ningún cargo a tu tarjeta.`,
          "Puedes intentarlo de nuevo con el mismo método de pago u otro distinto.",
        ],
        ctaLabel: "Reintentar mi pedido",
        ctaUrl: `${env.clientUrl}/pedidos/${orderNumber}`,
        disclaimer: "Si el problema persiste, responde este correo o contáctanos.",
      }),
    });
  },

  async sendAdminAlertEmail({ subject, title, bodyParagraphs }) {
    await send({
      to: env.adminAlertEmail,
      subject,
      html: renderTransactionalEmail({
        preheader: title,
        greetingName: "equipo",
        bodyParagraphs: [`<strong>${title}</strong>`, ...bodyParagraphs],
        ctaLabel: "Ver panel de administración",
        ctaUrl: `${env.clientUrl}/admin`,
        disclaimer: "Esta es una alerta interna de operación de Black & White Bikes.",
      }),
    });
  },
};
