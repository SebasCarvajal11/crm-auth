import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../config/env";
import type { TransactionalEmailJob } from "./transactional-email.types";

const basePublicUrl = env.APP_PUBLIC_URL.replace(/\/$/, "");

let smtpTransport: nodemailer.Transporter | undefined;

const getSmtpTransport = (): nodemailer.Transporter => {
  if (!smtpTransport) {
    const opts: SMTPTransport.Options = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    };
    smtpTransport = nodemailer.createTransport(opts);
  }
  return smtpTransport;
};

const sendRaw = async (opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => {
  const payload = {
    from: env.MAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  };

  if (env.MAIL_TRANSPORT === "log") {
    console.log("[mail:log]", payload.subject, "→", opts.to);
    console.log(payload.text);
    return;
  }

  await getSmtpTransport().sendMail(payload);
};

export const sendTransactionalEmail = async (
  job: TransactionalEmailJob
): Promise<void> => {
  switch (job.type) {
    case "password_reset": {
      const link = `${basePublicUrl}/reset-password?token=${encodeURIComponent(job.token)}`;
      await sendRaw({
        to: job.to,
        subject: "Recuperación de contraseña — CIMA CRM",
        text: `Usa este enlace para restablecer tu contraseña (válido por 1 hora):\n${link}\n\nSi no solicitaste el cambio, ignora este mensaje.`,
        html: `<p>Hola,</p><p>Para restablecer tu contraseña, haz clic en el siguiente enlace (válido por 1 hora):</p><p><a href="${link}">${link}</a></p><p>Si no solicitaste este cambio, puedes ignorar este correo.</p>`,
      });
      return;
    }
    case "client_invite": {
      const link = `${basePublicUrl}/accept-invite?token=${encodeURIComponent(job.token)}`;
      await sendRaw({
        to: job.to,
        subject: "Invitación — CIMA CRM",
        text: `Has sido invitado a CIMA CRM. Completa tu registro y define tu contraseña aquí:\n${link}\n`,
        html: `<p>Has sido invitado a <strong>CIMA CRM</strong>.</p><p><a href="${link}">Completar registro</a></p>`,
      });
      return;
    }
    case "worker_welcome": {
      await sendRaw({
        to: job.to,
        subject: "Tu cuenta de trabajo — CIMA CRM",
        text: `Hola,\n\nSe creó tu cuenta (${job.to}). Tu contraseña temporal es: ${job.tempPassword}\n\nInicia sesión y cámbiala cuanto antes.`,
        html: `<p>Hola,</p><p>Se creó tu cuenta de trabajo para <strong>${escapeHtml(job.to)}</strong>.</p><p><strong>Contraseña temporal:</strong> <code>${escapeHtml(job.tempPassword)}</code></p><p>Inicia sesión y cámbiala cuanto antes.</p>`,
      });
      return;
    }
    case "email_verify": {
      const link = `${basePublicUrl}/verify-email?token=${encodeURIComponent(job.token)}`;
      await sendRaw({
        to: job.to,
        subject: "Verifica tu correo — CIMA CRM",
        text: `Confirma tu correo con este enlace (válido 48 h):\n${link}\n\nTambién puedes pegar el token en la app si lo solicita.`,
        html: `<p>Confirma tu correo:</p><p><a href="${link}">${link}</a></p><p>El enlace expira en 48 horas.</p>`,
      });
      return;
    }
  }
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
