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
 * Accent Rule is relaxed on purpose for this shell, at the owner's request:
 * dorado appears on the header's rhino mark and on the single CTA button —
 * the only two dorado elements here, never a background or a third flourish.
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

/**
 * The rhino mark, dorado variant (header band sits on `COLOR.negro`) — the
 * owner asked for it in brand yellow rather than white, so this is now the
 * shell's second dorado element alongside the CTA button (see the file's top
 * comment). Exported at icon size from `handoff/brand-assets/rhino-dorado@2400.png`
 * (source copy also kept at `apps/web/public/brand/rhino-dorado-email.png`
 * for whoever needs to regenerate this string). Inlined as a data URI, same
 * reasoning as every other value in this file: an email client can't be
 * trusted to fetch an external asset reliably, so nothing here depends on
 * the site being deployed or reachable. Sized to `handoff/DESIGN_SYSTEM.md`
 * §5's accent range (12–28px) — a small mark beside the wordmark, never a
 * hero image.
 */
const LOGO_DATA_URI = "data:image/png;base64,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";

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
              <td align="center" style="background-color:${COLOR.negro}; padding:24px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td valign="middle" style="padding-right:10px;">
                      <img src="${LOGO_DATA_URI}" width="52" height="22" alt="" style="display:block; border:0;" />
                    </td>
                    <td valign="middle">
                      <span style="font-family:${FONT_STACK}; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:${COLOR.blanco};">
                        Black &amp; White Bikes
                      </span>
                    </td>
                  </tr>
                </table>
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
