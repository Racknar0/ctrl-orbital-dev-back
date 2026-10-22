import nodemailer from 'nodemailer';

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

const getMailConfig = () => {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS?.trim();

  if (!host || !user || !password) {
    throw new EmailDeliveryError('El envío de correo todavía no está configurado.');
  }

  return {
    host,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE?.toLowerCase() !== 'false',
    user,
    password: password.replace(/\s+/g, ''),
    from: process.env.SMTP_FROM?.trim() || user,
  };
};

const getAppUrl = () =>
  (process.env.APP_URL?.trim() || process.env.FRONTEND_URL?.trim() || 'http://localhost:3001').replace(/\/+$/, '');

const escapeHtml = (value: string) => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
};

export const assertEmailDeliveryConfigured = () => {
  getMailConfig();
};

const sendEmail = async (to: string, subject: string, text: string, html: string) => {
  const config = getMailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  await transporter.sendMail({ from: config.from, to, subject, text, html });
};

export const sendVerificationEmail = (to: string, name: string, token: string) => {
  const link = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);
  return sendEmail(
    to,
    'Confirma tu correo | Orbital Ctrl',
    `Hola ${name}, confirma tu correo para activar tu cuenta: ${link}\n\nEl enlace vence en 24 horas.`,
    `<main style="font-family:Arial,sans-serif;line-height:1.6;color:#24221f;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:24px">Confirma tu correo</h1><p>Hola ${safeName},</p><p>Confirma tu dirección para activar tu cuenta de Orbital Ctrl.</p><p><a href="${link}" style="display:inline-block;background:#24221f;color:#f7f6f2;padding:12px 20px;border-radius:24px;text-decoration:none">Verificar correo</a></p><p>El enlace vence en 24 horas. Si no creaste esta cuenta, puedes ignorar este mensaje.</p></main>`,
  );
};

export const sendPasswordResetEmail = (to: string, name: string, token: string) => {
  const link = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);
  return sendEmail(
    to,
    'Restablece tu contraseña | Orbital Ctrl',
    `Hola ${name}, restablece tu contraseña con este enlace: ${link}\n\nEl enlace vence en una hora. Si no solicitaste el cambio, ignora este mensaje.`,
    `<main style="font-family:Arial,sans-serif;line-height:1.6;color:#24221f;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:24px">Restablece tu contraseña</h1><p>Hola ${safeName},</p><p>Usa el siguiente enlace para elegir una contraseña nueva.</p><p><a href="${link}" style="display:inline-block;background:#24221f;color:#f7f6f2;padding:12px 20px;border-radius:24px;text-decoration:none">Cambiar contraseña</a></p><p>El enlace vence en una hora. Si no solicitaste el cambio, ignora este mensaje.</p></main>`,
  );
};
