import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../config/env";
import { withRetry } from "@sebascarvajal11/cima-contracts";
import type { TransactionalEmailJob } from "./transactional-email.types";
import { renderTransactionalEmail } from "./transactional-email.templates";
import { getLogger } from "../shared/logger";

const logger = getLogger();

let smtpTransport: nodemailer.Transporter | undefined;
let smtpVerified = false;

const getSmtpTransport = (): nodemailer.Transporter => {
  if (!smtpTransport) {
    const opts: SMTPTransport.Options = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      requireTLS: env.SMTP_REQUIRE_TLS,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
      tls:
        env.SMTP_TLS_SERVERNAME || env.SMTP_HOST
          ? { servername: env.SMTP_TLS_SERVERNAME ?? env.SMTP_HOST }
          : undefined,
    };
    smtpTransport = nodemailer.createTransport(opts);
  }
  return smtpTransport;
};

const ensureSmtpReady = async (): Promise<nodemailer.Transporter> => {
  const transport = getSmtpTransport();
  if (!smtpVerified) {
    await transport.verify();
    smtpVerified = true;
  }
  return transport;
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
    logger.info({ topic: "mail:log", subject: payload.subject, to: opts.to }, "email sent");
    logger.debug({ text: payload.text }, "email body");
    return;
  }

  const transport = await ensureSmtpReady();
  await withRetry(async () => {
    await transport.sendMail(payload);
  }, {
    maxAttempts: 3,
    delayMs: 200,
  });
};

export const sendTransactionalEmail = async (
  job: TransactionalEmailJob
): Promise<void> => {
  const rendered = renderTransactionalEmail(job, env.APP_PUBLIC_URL);
  await sendRaw({
    to: job.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
};
