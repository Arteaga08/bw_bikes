/**
 * Shared table-based HTML shell for every transactional email `resend.mailer.ts`
 * sends. Email clients don't run a CSS engine — no flexbox/grid, `<style>` in
 * `<head>` gets stripped by a chunk of clients (Outlook desktop chief among
 * them), and border-radius is a "nice if honored" rather than a guarantee —
 * so every rule here is inlined and every layout primitive is a `<table>`,
 * the one thing every client, Outlook included, renders consistently.
 *
 * Colors/type/radii are DESIGN.md's tokens by hex — `@theme` CSS variables
 * never resolve inside an email client, so there is no import path from
 * `globals.css` here; these are the same values, copied by hand. The One
 * Accent Rule carries over unchanged: dorado appears exactly once, on the
 * single CTA button, never as a background or a repeated flourish.
 */

const COLOR = {
  negro: "#0A0A0A",
  blanco: "#FAFAFA",
  grafito: "#3A3A38",
  dorado: "#F2B705",
  doradoHover: "#D9A404",
  base: "#F1F1EE",
  surface: "#FFFFFF",
  borde: "#E2E2DE",
} as const;

const FONT_STACK = "'Hanken Grotesk', Helvetica, Arial, sans-serif";

export interface TransactionalEmailParams {
  /** Hidden inbox-preview text — without it, clients preview whatever text node comes first, usually a stray blank line. */
  preheader: string;
  greetingName: string;
  /** Paragraphs of the message body, already safe HTML (written by this codebase, never by a customer) — one `<p>` per entry. */
  bodyParagraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  /** The "if this wasn't you" line — every transactional email here carries one. */
  disclaimer: string;
}

/**
 * The "bulletproof button" table-cell technique: a table with one padded,
 * background-colored `<td>` wrapping the link, rather than a plain `<a>`
 * styled as a button. Outlook desktop's Word rendering engine ignores
 * padding/border-radius on an `<a>` outright but honors it on a `<td>` —
 * this is the one part of the shell that would visibly break without the
 * table wrapper, not just degrade gracefully.
 */
function renderButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background-color:${COLOR.dorado}; border-radius:2px;">
          <a href="${url}"
             style="display:inline-block; padding:14px 32px; font-family:${FONT_STACK}; font-size:13px; font-weight:700; letter-spacing:0.5px; color:${COLOR.negro}; text-decoration:none;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function renderTransactionalEmail(params: TransactionalEmailParams): string {
  const paragraphsHtml = params.bodyParagraphs
    .map(
      (paragraph) =>
        // 16px — DESIGN.md's `body-l` step, not `body` (14px): email has no
        // hover/zoom affordance the way a page does, and 16px is also the
        // floor several mail clients use to decide whether to auto-zoom text.
        `<p style="margin:0 0 16px; font-family:${FONT_STACK}; font-size:16px; line-height:1.6; color:${COLOR.negro};">${paragraph}</p>`,
    )
    .join("");

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title></title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLOR.base};">
    <!-- The 1px font-size below is not a typography choice, off DESIGN.md's
         ramp or otherwise — this text never renders. It's the standard
         email "preheader hack": zero-size, zero-height, same color as its
         own background, present only so the client's inbox list preview
         shows real copy instead of the header band's whitespace. -->
    <div style="display:none; max-height:0; overflow:hidden; font-size:1px; line-height:1px; color:${COLOR.base};">
      ${params.preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.base};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:${COLOR.surface}; border:1px solid ${COLOR.borde}; border-radius:14px; overflow:hidden;">

            <!-- Header band — the nav's own negro carbono, same role here: the brand's ground. -->
            <tr>
              <td align="center" style="background-color:${COLOR.negro}; padding:28px 24px;">
                <span style="font-family:${FONT_STACK}; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:${COLOR.blanco};">
                  Black &amp; White Bikes
                </span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px 32px 32px;">
                <p style="margin:0 0 20px; font-family:${FONT_STACK}; font-size:16px; line-height:1.6; color:${COLOR.negro};">
                  Hola ${params.greetingName},
                </p>
                ${paragraphsHtml}
                <div style="margin:28px 0 24px;">
                  ${renderButton(params.ctaLabel, params.ctaUrl)}
                </div>
                <p style="margin:0; font-family:${FONT_STACK}; font-size:11px; line-height:1.6; color:${COLOR.grafito};">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
                  <a href="${params.ctaUrl}" style="color:${COLOR.grafito};">${params.ctaUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Disclaimer -->
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0; padding-top:20px; border-top:1px solid ${COLOR.borde}; font-family:${FONT_STACK}; font-size:11px; line-height:1.6; color:${COLOR.grafito};">
                  ${params.disclaimer}
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="background-color:${COLOR.base}; padding:20px 24px;">
                <p style="margin:0; font-family:${FONT_STACK}; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:${COLOR.grafito};">
                  Black &amp; White Bikes
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
