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

export const renderVerificationEmailHtml = (name: string, link: string) => {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Activa tu cuenta | Orbital Ctrl</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f3ef;font-family:Arial,Helvetica,sans-serif;color:#20221f;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Confirma tu correo y empieza a organizar tus finanzas con Orbital Ctrl.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f3ef;">
      <tr>
        <td align="center" style="padding:36px 14px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border:1px solid #e4e2db;border-radius:12px;background-color:#ffffff;overflow:hidden;">
            <tr>
              <td style="padding:25px 34px 22px;border-bottom:1px solid #efeee9;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" valign="middle" width="36" height="36" style="width:36px;height:36px;border:1px solid #dfc29c55;border-radius:12px;background-color:#20221f;color:#e7d5b6;font-family:Georgia,serif;font-size:19px;">O</td>
                    <td style="padding-left:10px;color:#24251f;font-size:14px;font-weight:bold;letter-spacing:-.4px;">Orbital Ctrl<br><span style="color:#8b8b82;font-size:10px;font-weight:normal;letter-spacing:.4px;">by Orbital Dev</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 42px 34px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                  <tr><td style="padding:6px 10px;border:1px solid #e9e3d7;border-radius:20px;background-color:#faf8f3;color:#876b40;font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;"><span style="color:#618376;">●</span>&nbsp; SEGURIDAD DE TU CUENTA</td></tr>
                </table>
                <h1 style="margin:0 0 16px;color:#24251f;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:normal;line-height:1.15;letter-spacing:-1px;">Activa tu cuenta</h1>
                <p style="margin:0 0 18px;color:#60635b;font-size:15px;line-height:1.75;">Hola, <strong style="color:#30322c;">${safeName}</strong>.</p>
                <p style="margin:0;color:#60635b;font-size:15px;line-height:1.75;">Gracias por unirte a Orbital Ctrl. Confirma tu correo para activar tu cuenta y empezar a organizar tus finanzas con claridad.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 18px;">
                  <tr><td align="center" bgcolor="#273c34" style="border-radius:7px;background-color:#273c34;"><a href="${safeLink}" target="_blank" style="display:inline-block;padding:14px 22px;border:1px solid #273c34;border-radius:7px;color:#ffffff;font-size:13px;font-weight:bold;line-height:1;text-decoration:none;">Confirmar mi correo&nbsp; &rarr;</a></td></tr>
                </table>
                <p style="margin:0;color:#85877f;font-size:12px;line-height:1.65;">Este enlace es válido durante 24 horas. Si no creaste una cuenta, puedes ignorar este mensaje.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:25px;border:1px solid #e8e7e1;border-radius:8px;background-color:#fafaf8;">
                  <tr><td valign="top" width="32" style="width:32px;padding:14px 0 14px 14px;color:#8b7048;font-size:17px;">◇</td><td style="padding:13px 14px 13px 4px;color:#696c64;font-size:12px;line-height:1.55;"><strong style="display:block;margin-bottom:2px;color:#383b34;font-size:12px;">Un paso para proteger tu cuenta</strong>Orbital nunca te pedirá tu contraseña por correo.</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 26px 22px;border-top:1px solid #efeee9;background-color:#fcfcfa;color:#898b83;font-size:11px;line-height:1.7;">
                Este mensaje fue enviado por Orbital Ctrl.<br>
                Si necesitas ayuda, ponte en contacto con el equipo de Orbital Dev.<br>
                &copy; ${new Date().getFullYear()} Orbital Ctrl &middot; Orbital Dev
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const renderPasswordResetEmailHtml = (name: string, link: string) => {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Restablece tu contraseña | Orbital Ctrl</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f3ef;font-family:Arial,Helvetica,sans-serif;color:#20221f;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Restablece tu contraseña de Orbital Ctrl de forma segura.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f3ef;">
      <tr>
        <td align="center" style="padding:36px 14px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border:1px solid #e4e2db;border-radius:12px;background-color:#ffffff;overflow:hidden;">
            <tr>
              <td style="padding:25px 34px 22px;border-bottom:1px solid #efeee9;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" valign="middle" width="36" height="36" style="width:36px;height:36px;border:1px solid #dfc29c55;border-radius:12px;background-color:#20221f;color:#e7d5b6;font-family:Georgia,serif;font-size:19px;">O</td>
                    <td style="padding-left:10px;color:#24251f;font-size:14px;font-weight:bold;letter-spacing:-.4px;">Orbital Ctrl<br><span style="color:#8b8b82;font-size:10px;font-weight:normal;letter-spacing:.4px;">by Orbital Dev</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 42px 34px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                  <tr><td style="padding:6px 10px;border:1px solid #e9e3d7;border-radius:20px;background-color:#faf8f3;color:#876b40;font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;"><span style="color:#618376;">●</span>&nbsp; SEGURIDAD DE TU CUENTA</td></tr>
                </table>
                <h1 style="margin:0 0 16px;color:#24251f;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:normal;line-height:1.15;letter-spacing:-1px;">Restablece tu contraseña</h1>
                <p style="margin:0 0 18px;color:#60635b;font-size:15px;line-height:1.75;">Hola, <strong style="color:#30322c;">${safeName}</strong>.</p>
                <p style="margin:0;color:#60635b;font-size:15px;line-height:1.75;">Recibimos una solicitud para cambiar la contraseña de tu cuenta. Usa el botón para elegir una nueva.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 18px;">
                  <tr><td align="center" bgcolor="#273c34" style="border-radius:7px;background-color:#273c34;"><a href="${safeLink}" target="_blank" style="display:inline-block;padding:14px 22px;border:1px solid #273c34;border-radius:7px;color:#ffffff;font-size:13px;font-weight:bold;line-height:1;text-decoration:none;">Crear nueva contraseña&nbsp; &rarr;</a></td></tr>
                </table>
                <p style="margin:0;color:#85877f;font-size:12px;line-height:1.65;">Por seguridad, este enlace vence en una hora. Si no solicitaste el cambio, ignora este correo; tu contraseña seguirá igual.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:25px;border:1px solid #e8e7e1;border-radius:8px;background-color:#fafaf8;">
                  <tr><td valign="top" width="32" style="width:32px;padding:14px 0 14px 14px;color:#8b7048;font-size:17px;">◇</td><td style="padding:13px 14px 13px 4px;color:#696c64;font-size:12px;line-height:1.55;"><strong style="display:block;margin-bottom:2px;color:#383b34;font-size:12px;">Mantén tu cuenta protegida</strong>Nunca compartas este enlace ni tu contraseña. Orbital nunca te pedirá tu contraseña por correo.</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 26px 22px;border-top:1px solid #efeee9;background-color:#fcfcfa;color:#898b83;font-size:11px;line-height:1.7;">
                Este mensaje fue enviado por Orbital Ctrl.<br>
                Si necesitas ayuda, ponte en contacto con el equipo de Orbital Dev.<br>
                &copy; ${new Date().getFullYear()} Orbital Ctrl &middot; Orbital Dev
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
  return sendEmail(
    to,
    'Confirma tu correo | Orbital Ctrl',
    `Hola ${name}, confirma tu correo para activar tu cuenta: ${link}\n\nEl enlace vence en 24 horas.`,
    renderVerificationEmailHtml(name, link),
  );
};

export const sendPasswordResetEmail = (to: string, name: string, token: string) => {
  const link = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail(
    to,
    'Restablece tu contraseña | Orbital Ctrl',
    `Hola ${name}, restablece tu contraseña con este enlace: ${link}\n\nEl enlace vence en una hora. Si no solicitaste el cambio, ignora este mensaje.`,
    renderPasswordResetEmailHtml(name, link),
  );
};
