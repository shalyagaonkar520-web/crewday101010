import nodemailer, { type Transporter } from 'nodemailer'
import QRCode from 'qrcode'

/**
 * Outbound email.
 *
 * SMTP credentials come from the function's environment (`functions/.env`,
 * which is gitignored) — never from the client bundle, where anyone could read
 * them. See the README for moving them into Secret Manager, which is the
 * better home for a password.
 */

const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465)
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASSWORD = (process.env.SMTP_PASSWORD ?? '').replace(/\s+/g, '')
const FROM_NAME = process.env.SMTP_FROM_NAME ?? 'CrewDay'
const APP_URL = (process.env.APP_URL ?? 'https://crewday-2657d.web.app').replace(/\/$/, '')

export const isEmailConfigured = Boolean(SMTP_USER && SMTP_PASSWORD)

let transporter: Transporter | null = null

function getTransport(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  })
  return transporter
}

export interface MailAttachment {
  filename: string
  content: Buffer
  cid?: string
  contentType?: string
}

export async function sendMail(options: {
  to: string
  subject: string
  html: string
  text: string
  attachments?: MailAttachment[]
}): Promise<void> {
  if (!isEmailConfigured) throw new Error('SMTP is not configured')
  await getTransport().sendMail({
    from: `"${FROM_NAME}" <${SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  })
}

/** PNG of the ticket QR, sized for both inline display and saving. */
export async function renderQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: 520,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#16273aff', light: '#ffffffff' },
  })
}

/* -------------------------------------------------------------------------- */
/*                                  Templates                                 */
/* -------------------------------------------------------------------------- */

const BRAND_PINK = '#ff4d8d'
const BRAND_BLUE = '#4a9eff'
const INK = '#16273a'
const MUTED = '#6480a1'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email shell.
 *
 * Tables and inline styles, not flexbox — Outlook and several Android clients
 * still ignore modern CSS, and a ticket that renders as a stack of unstyled
 * text is worse than no email at all.
 */
function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#fdfaff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfaff;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(22,39,58,0.08);">
      <tr>
        <td style="background:linear-gradient(100deg,${BRAND_PINK},${BRAND_BLUE});padding:26px 28px;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">CrewDay</div>
          <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);letter-spacing:3px;margin-top:2px;">SOCIAL APP</div>
        </td>
      </tr>
      ${body}
      <tr>
        <td style="padding:22px 28px;background:#f7fafd;">
          <p style="margin:0;font-size:12px;line-height:19px;color:${MUTED};">
            Find your crew. Make your day.<br>
            <a href="${APP_URL}" style="color:${BRAND_PINK};text-decoration:none;font-weight:600;">Open CrewDay</a>
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#8aa3c0;">You received this because you used CrewDay.</p>
  </td></tr>
</table>
</body>
</html>`
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;font-size:13px;color:${MUTED};width:110px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-size:14px;color:${INK};font-weight:600;">${escapeHtml(value)}</td>
  </tr>`
}

export interface TicketEmailInput {
  name: string
  eventTitle: string
  eventDate: string
  eventTime: string
  venue: string
  registrationCode: string
  participationType: string
  price: string
  confirmed: boolean
  ticketUrl: string
}

export function renderTicketEmail(input: TicketEmailInput): { html: string; text: string } {
  const heading = input.confirmed ? "You're in! 🎉" : 'Almost there'
  const intro = input.confirmed
    ? `Your place at <strong>${escapeHtml(input.eventTitle)}</strong> is confirmed. Show the QR code below at the door and we'll check you straight in.`
    : `We've held your place at <strong>${escapeHtml(input.eventTitle)}</strong>. Your QR code activates as soon as payment is confirmed.`

  const body = `
  <tr>
    <td style="padding:30px 28px 8px;">
      <h1 style="margin:0 0 10px;font-size:25px;line-height:32px;font-weight:800;color:${INK};">${heading}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:23px;color:${MUTED};">
        Hi ${escapeHtml(input.name || 'there')} — ${intro}
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:#f7fafd;border-radius:18px;padding:16px 18px;">
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${detailRow('Event', input.eventTitle)}
            ${detailRow('Date', input.eventDate)}
            ${detailRow('Time', input.eventTime)}
            ${detailRow('Venue', input.venue)}
            ${detailRow('Joining as', input.participationType)}
            ${detailRow('Price', input.price)}
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  <tr>
    <td align="center" style="padding:24px 28px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0"
             style="background:linear-gradient(135deg,#fff1f6,#eff7ff);border-radius:22px;">
        <tr><td align="center" style="padding:22px;">
          <img src="cid:crewday-qr" width="220" height="220" alt="Your CrewDay ticket QR code"
               style="display:block;border-radius:14px;background:#ffffff;"/>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:${MUTED};">Registration ID</p>
      <p style="margin:2px 0 0;font-size:17px;font-weight:800;letter-spacing:1px;color:${INK};">
        ${escapeHtml(input.registrationCode)}
      </p>
    </td>
  </tr>

  <tr>
    <td align="center" style="padding:22px 28px 30px;">
      <a href="${input.ticketUrl}"
         style="display:inline-block;background:${BRAND_PINK};color:#ffffff;text-decoration:none;
                font-size:15px;font-weight:700;padding:14px 30px;border-radius:999px;">
        View my ticket
      </a>
      <p style="margin:16px 0 0;font-size:12px;line-height:19px;color:${MUTED};">
        Keep this email — the QR is your entry. It's also attached as an image you can save.
      </p>
    </td>
  </tr>`

  const text = [
    input.confirmed ? "You're in!" : 'Almost there',
    '',
    `Hi ${input.name || 'there'},`,
    input.confirmed
      ? `Your place at ${input.eventTitle} is confirmed.`
      : `We've held your place at ${input.eventTitle}. Your QR activates once payment is confirmed.`,
    '',
    `Event:      ${input.eventTitle}`,
    `Date:       ${input.eventDate}`,
    `Time:       ${input.eventTime}`,
    `Venue:      ${input.venue}`,
    `Joining as: ${input.participationType}`,
    `Price:      ${input.price}`,
    '',
    `Registration ID: ${input.registrationCode}`,
    '',
    `View your ticket: ${input.ticketUrl}`,
    '',
    'Find your crew. Make your day.',
  ].join('\n')

  return { html: shell(`Your ticket — ${input.eventTitle}`, body), text }
}

export function renderPasswordResetEmail(input: { name: string; link: string }): {
  html: string
  text: string
} {
  const body = `
  <tr>
    <td style="padding:30px 28px 10px;">
      <h1 style="margin:0 0 10px;font-size:24px;line-height:31px;font-weight:800;color:${INK};">Reset your password</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:23px;color:${MUTED};">
        Hi ${escapeHtml(input.name || 'there')} — tap the button below to choose a new CrewDay password.
        This link works once and expires in an hour.
      </p>
      <a href="${input.link}"
         style="display:inline-block;background:${BRAND_PINK};color:#ffffff;text-decoration:none;
                font-size:15px;font-weight:700;padding:14px 30px;border-radius:999px;">
        Choose a new password
      </a>
      <p style="margin:22px 0 0;font-size:12px;line-height:19px;color:${MUTED};">
        Didn't ask for this? You can safely ignore this email — your password stays as it is.
      </p>
      <p style="margin:14px 0 26px;font-size:11px;line-height:18px;color:#8aa3c0;word-break:break-all;">
        If the button doesn't work, paste this into your browser:<br>${escapeHtml(input.link)}
      </p>
    </td>
  </tr>`

  const text = [
    'Reset your CrewDay password',
    '',
    `Hi ${input.name || 'there'},`,
    'Use this link to choose a new password. It works once and expires in an hour.',
    '',
    input.link,
    '',
    "Didn't ask for this? Ignore this email — your password stays as it is.",
  ].join('\n')

  return { html: shell('Reset your CrewDay password', body), text }
}

export { APP_URL }
