import type { TransactionalEmailJob } from "./transactional-email.types";

type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

const brand = {
  appName: "CIMA CRM",
  primary: "#8F2B2E",
  primaryDark: "#5f1a1d",
  accent: "#0066ff",
  accentSoft: "#e7f0ff",
  ink: "#0f172a",
  mutedInk: "#475569",
  border: "#d9e2ec",
  bg: "#eef2f7",
  card: "#ffffff",
  softRose: "#fff2f4",
  softAmber: "#fff9eb",
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const p = (content: string) =>
  `<p style=\"margin:0 0 16px 0; color:${brand.ink}; font-size:16px; line-height:1.6;\">${content}</p>`;

const eyebrow = (content: string) =>
  `<span style=\"display:inline-block; padding:7px 12px; border-radius:999px; background:rgba(255,255,255,.2); color:#fff; border:1px solid rgba(255,255,255,.35); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;\">${escapeHtml(content)}</span>`;

const metricPill = (label: string, value: string) =>
  `<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:0 0 16px 0;\"><tr><td style=\"padding:8px 12px; border-radius:999px; border:1px solid ${brand.border}; background:${brand.accentSoft};\"><span style=\"font-size:12px; color:${brand.mutedInk};\">${escapeHtml(label)}:</span> <span style=\"font-size:12px; color:${brand.accent}; font-weight:700;\">${escapeHtml(value)}</span></td></tr></table>`;

const actionButton = (href: string, label: string) =>
  `<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:0 0 8px 0;\"><tr><td style=\"border-radius:12px; background:linear-gradient(120deg, ${brand.primary} 0%, ${brand.primaryDark} 100%);\"><a href=\"${href}\" style=\"display:inline-block; padding:13px 22px; color:#fff; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:.01em;\">${escapeHtml(label)} -></a></td></tr></table>`;

const safeLink = (href: string) =>
  `<div style=\"margin-top:14px; padding:12px 14px; border-radius:10px; border:1px solid ${brand.border}; background:#fbfdff; color:${brand.mutedInk}; font-size:13px; line-height:1.5;\">Si el boton no funciona, copia este enlace:<br /><a href=\"${href}\" style=\"color:${brand.accent}; text-decoration:underline; word-break:break-all;\">${href}</a></div>`;

const infoCard = (title: string, body: string, tone: "warning" | "neutral" = "warning") => {
  const bg = tone === "warning" ? brand.softRose : brand.softAmber;
  const border = tone === "warning" ? brand.primary : "#d97706";
  return `<div style=\"margin:18px 0 0 0; padding:14px 16px; border-radius:12px; border:1px solid ${brand.border}; background:${bg};\"><p style=\"margin:0 0 7px 0; color:${brand.ink}; font-size:14px; font-weight:700;\">${escapeHtml(title)}</p><p style=\"margin:0; color:${brand.mutedInk}; font-size:14px; line-height:1.55; border-left:3px solid ${border}; padding-left:10px;\">${body}</p></div>`;
};

const monoCard = (content: string) =>
  `<div style=\"margin:0 0 18px 0; padding:14px 16px; border-radius:12px; border:1px dashed ${brand.border}; background:#f8fbff; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace; font-size:15px; color:${brand.ink}; word-break:break-word;\">${escapeHtml(content)}</div>`;

const renderShell = (params: {
  preview: string;
  eyebrowText: string;
  title: string;
  intro: string;
  bodyHtml: string;
  outro?: string;
}) => {
  const footer = params.outro
    ? p(params.outro)
    : p(
        "Este correo fue generado automaticamente por CIMA CRM. Si no reconoces esta accion, ignora este mensaje."
      );

  return `<!doctype html>
<html lang=\"es\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style=\"margin:0; padding:26px 12px; background:${brand.bg}; font-family:Inter, Segoe UI, Helvetica Neue, Arial, sans-serif;\">
    <div style=\"display:none; max-height:0; overflow:hidden; opacity:0;\">${escapeHtml(params.preview)}</div>
    <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"max-width:640px; margin:0 auto;\">
      <tr>
        <td style=\"padding:0; border-radius:18px; overflow:hidden;\">
          <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"background:${brand.card}; border:1px solid ${brand.border}; border-radius:18px; box-shadow:0 10px 28px rgba(15, 23, 42, .10);\">
            <tr>
              <td style=\"padding:26px 24px 24px 24px; background:radial-gradient(110% 140% at 0% 0%, #b23d42 0%, ${brand.primary} 42%, ${brand.primaryDark} 100%);\">
                ${eyebrow(params.eyebrowText)}
                <h1 style=\"margin:14px 0 0 0; color:#fff; font-size:30px; line-height:1.18; font-weight:800;\">${escapeHtml(params.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style=\"padding:24px;\">
                ${p(params.intro)}
                ${params.bodyHtml}
                <hr style=\"margin:24px 0; border:none; border-top:1px solid ${brand.border};\" />
                ${footer}
                <p style=\"margin:8px 0 0 0; color:${brand.mutedInk}; font-size:12px;\">${brand.appName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const renderPasswordReset = (to: string, link: string): RenderedEmail => ({
  subject: "Recuperacion de contrasena - CIMA CRM",
  text: [
    "Solicitud de recuperacion de contrasena",
    "",
    `Correo asociado: ${to}`,
    "Usa este enlace para restablecer tu contrasena (valido por 1 hora):",
    link,
    "",
    "Si no solicitaste este cambio, ignora este mensaje.",
  ].join("\n"),
  html: renderShell({
    preview: "Recupera el acceso a tu cuenta en un paso.",
    eyebrowText: "Seguridad de cuenta",
    title: "Recupera tu acceso",
    intro: "Recibimos una solicitud para restablecer tu contrasena. Este enlace expira en 1 hora.",
    bodyHtml: `${metricPill("Cuenta", to)}${actionButton(link, "Restablecer contrasena")}${safeLink(link)}${infoCard(
      "No reconoces esta solicitud?",
      "Puedes ignorar este correo. Tu contrasena actual seguira activa mientras no uses este enlace."
    )}`,
  }),
});

const renderClientInvite = (to: string, link: string): RenderedEmail => ({
  subject: "Invitacion - CIMA CRM",
  text: [
    "Invitacion a CIMA CRM",
    "",
    `Correo invitado: ${to}`,
    "Completa tu registro desde este enlace:",
    link,
    "",
    "El enlace solo debe usarse por el titular de este correo.",
  ].join("\n"),
  html: renderShell({
    preview: "Activa tu cuenta y comienza en CIMA CRM.",
    eyebrowText: "Invitacion de acceso",
    title: "Tu acceso te espera",
    intro: "Un administrador te invito a CIMA CRM. Completa tu activacion para iniciar.",
    bodyHtml: `${metricPill("Correo invitado", to)}${actionButton(link, "Completar registro")}${safeLink(link)}${infoCard(
      "Importante",
      "Este enlace crea una cuenta asociada solo a este correo.",
      "neutral"
    )}`,
  }),
});

const renderWorkerWelcome = (to: string, tempPassword: string): RenderedEmail => ({
  subject: "Tu cuenta de trabajo - CIMA CRM",
  text: [
    "Cuenta de trabajo creada",
    "",
    `Correo: ${to}`,
    `Contrasena temporal: ${tempPassword}`,
    "",
    "Inicia sesion y cambiala de inmediato desde tu panel de cuenta.",
  ].join("\n"),
  html: renderShell({
    preview: "Tu cuenta fue creada. Revisa tu acceso temporal.",
    eyebrowText: "Alta de trabajador",
    title: "Bienvenido a tu cuenta",
    intro: "Tu acceso fue creado correctamente. Usa esta contrasena temporal para el primer ingreso.",
    bodyHtml: `${metricPill("Usuario", to)}${p("<strong>Contrasena temporal:</strong>")}${monoCard(
      tempPassword
    )}${infoCard(
      "Accion recomendada",
      "Despues de iniciar sesion, cambia tu contrasena para proteger tu cuenta.",
      "neutral"
    )}`,
  }),
});

const renderVerifyEmail = (link: string): RenderedEmail => ({
  subject: "Verifica tu correo - CIMA CRM",
  text: [
    "Verificacion de correo",
    "",
    "Confirma tu direccion de correo con este enlace (valido por 48 horas):",
    link,
    "",
    "Si no realizaste esta solicitud, ignora este mensaje.",
  ].join("\n"),
  html: renderShell({
    preview: "Confirma tu correo y termina la activacion.",
    eyebrowText: "Verificacion de identidad",
    title: "Confirma tu correo",
    intro: "Para completar la activacion, confirma que esta direccion de correo te pertenece.",
    bodyHtml: `${actionButton(link, "Verificar correo")}${safeLink(link)}${infoCard(
      "Vigencia del enlace",
      "Este enlace expira en 48 horas. Si vence, solicita uno nuevo desde tu cuenta."
    )}`,
  }),
});

export const renderTransactionalEmail = (
  job: TransactionalEmailJob,
  appPublicUrl: string
): RenderedEmail => {
  const basePublicUrl = appPublicUrl.replace(/\/$/, "");
  switch (job.type) {
    case "password_reset": {
      const link = `${basePublicUrl}/reset-password?token=${encodeURIComponent(job.token)}`;
      return renderPasswordReset(job.to, link);
    }
    case "client_invite": {
      const link = `${basePublicUrl}/accept-invite/${encodeURIComponent(job.token)}`;
      return renderClientInvite(job.to, link);
    }
    case "worker_welcome":
      return renderWorkerWelcome(job.to, job.tempPassword);
    case "email_verify": {
      const link = `${basePublicUrl}/verify-email?token=${encodeURIComponent(job.token)}`;
      return renderVerifyEmail(link);
    }
  }
};
