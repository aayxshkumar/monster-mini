import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? "Archivio <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendInviteEmail(opts: {
  to: string;
  cafeName: string;
  role: string;
  signUpUrl: string;
}): Promise<boolean> {
  if (!resend) return false;

  try {
    await resend.emails.send({
      from,
      to: opts.to,
      subject: `You've been invited to ${opts.cafeName} on Archivio`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">You're invited!</h2>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            You've been added as <strong>${opts.role.replace("_", " ")}</strong> at <strong>${opts.cafeName}</strong> on Archivio Photo Booth.
          </p>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            Create your account to get started:
          </p>
          <a href="${opts.signUpUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; margin-top: 12px;">
            Create Account
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            If you didn't expect this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
    return true;
  } catch {
    return false;
  }
}
