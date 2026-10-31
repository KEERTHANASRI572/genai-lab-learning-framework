import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  reason?: 'EMAIL_SERVICE_UNCONFIGURED' | 'EMAIL_DELIVERY_FAILED' | 'SUCCESS';
  error?: string;
  messageId?: string;
  response?: string;
}

/**
 * Checks whether SMTP environment variables are properly configured.
 */
export const isEmailConfigured = (): boolean => {
  const host = process.env['SMTP_HOST']?.trim();
  const user = process.env['SMTP_USER']?.trim();
  const pass = process.env['SMTP_PASS']?.trim();
  return Boolean(host && user && pass);
};

/**
 * Returns safe diagnostic metadata about current SMTP configuration without leaking secrets.
 */
export const getSmtpConfigurationSummary = () => {
  const host = process.env['SMTP_HOST']?.trim();
  const port = parseInt(process.env['SMTP_PORT'] || '587', 10);
  const user = process.env['SMTP_USER']?.trim();
  const from = process.env['EMAIL_FROM']?.trim() || 'noreply@genai-lab-learning.edu';

  return {
    isConfigured: isEmailConfigured(),
    host: host || 'UNCONFIGURED',
    port,
    user: user ? `${user.substring(0, 3)}***` : 'UNCONFIGURED',
    sender: from,
  };
};

/**
 * Dispatches an email via Nodemailer SMTP.
 * Strictly avoids pretending emails were sent when unconfigured:
 * returns an honest failure result explaining the missing configuration or delivery rejection.
 */
export const sendEmail = async (options: EmailOptions): Promise<EmailDeliveryResult> => {
  const host = process.env['SMTP_HOST']?.trim();
  const port = parseInt(process.env['SMTP_PORT'] || '587', 10);
  const user = process.env['SMTP_USER']?.trim();
  const pass = process.env['SMTP_PASS']?.trim();
  const from = process.env['EMAIL_FROM']?.trim() || 'noreply@genai-lab-learning.edu';

  if (!host || !user || !pass) {
    return {
      delivered: false,
      reason: 'EMAIL_SERVICE_UNCONFIGURED',
      error: 'SMTP service is not configured. Please define SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend environment.',
    };
  }

  const isSecure = port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    });

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return {
      delivered: true,
      reason: 'SUCCESS',
      messageId: info.messageId,
      response: typeof info.response === 'string' ? info.response : '250 Message accepted for delivery',
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown SMTP delivery error';
    return {
      delivered: false,
      reason: 'EMAIL_DELIVERY_FAILED',
      error: errMsg,
    };
  }
};

/**
 * Dispatch an account invitation email to a specific user.
 */
export const sendInvitationEmail = async (
  email: string,
  name: string,
  activationUrl: string,
  institutionName: string
): Promise<EmailDeliveryResult> => {
  const subject = `Activate Your Account - ${institutionName}`;
  const text = `Hello ${name},\n\nYou have been invited to join ${institutionName} on the Generative AI Personalized Laboratory Learning Framework.\n\nPlease activate your account and establish your personal password by visiting the link below:\n${activationUrl}\n\nThis invitation link expires in 48 hours and is single-use.\n\nIf you did not request this invitation, please disregard this email.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0 0 8px 0; font-size: 1.4rem;">Welcome to ${institutionName}</h2>
        <span style="font-size: 0.85rem; color: #64748b;">Generative AI Framework for Personalized Laboratory Learning</span>
      </div>
      <p style="color: #334155; font-size: 1rem; line-height: 1.5;">Hello <strong>${name}</strong>,</p>
      <p style="color: #334155; font-size: 0.95rem; line-height: 1.6;">
        Your account has been provisioned on the Generative AI Laboratory Learning Environment. To get started, please establish your private password and activate your account using the secure link below:
      </p>
      <div style="margin: 28px 0;">
        <a href="${activationUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.95rem; display: inline-block;">
          Activate Your Account
        </a>
      </div>
      <p style="font-size: 0.85rem; color: #64748b; line-height: 1.5;">
        <strong>Security Notice:</strong> This single-use link is personalized for <code>${email}</code> and expires in 48 hours. Never share this link with anyone.
      </p>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 0.8rem; color: #94a3b8;">
        If the button does not work, copy and paste this URL into your browser:<br/>
        <a href="${activationUrl}" style="color: #6366f1; word-break: break-all;">${activationUrl}</a>
      </div>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Dispatch a password reset email to a specific user.
 */
export const sendPasswordResetEmail = async (
  email: string,
  resetUrl: string
): Promise<EmailDeliveryResult> => {
  const subject = `Password Reset Request - GenAI Laboratory Learning Framework`;
  const text = `A password reset was requested for your account.\n\nPlease visit the following link to configure a new password:\n${resetUrl}\n\nThis single-use reset link expires in 60 minutes.\n\nIf you did not request a password reset, you may safely ignore this message.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #4f46e5; margin: 0 0 12px 0;">Password Reset Request</h2>
      <p style="color: #334155; font-size: 0.95rem; line-height: 1.5;">
        A password reset was requested for your institutional account (<code>${email}</code>).
      </p>
      <p style="color: #334155; font-size: 0.95rem; line-height: 1.5;">
        Please click the button below to configure your new secure password:
      </p>
      <div style="margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.95rem; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 0.85rem; color: #64748b; line-height: 1.5;">
        <strong>Security Notice:</strong> This single-use link expires in 60 minutes. If you did not request this reset, your account is secure and no action is required.
      </p>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 0.8rem; color: #94a3b8;">
        URL: <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
      </div>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
};
