import { Resend } from "resend";
import nodemailer from "nodemailer";

class MockResend {
  emails = {
    send: async (payload: {
      from: string;
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
      cc?: string | string[];
      bcc?: string | string[];
      reply_to?: string | string[];
    }) => {
      console.log(`[MockResend] Sending email via local SMTP (Mailpit) to: ${payload.to}...`);
      try {
        const transporter = nodemailer.createTransport({
          host: "127.0.0.1",
          port: 54325,
          secure: false,
          tls: {
            rejectUnauthorized: false,
          },
        });

        const to = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;
        const cc = Array.isArray(payload.cc) ? payload.cc.join(", ") : payload.cc;
        const bcc = Array.isArray(payload.bcc) ? payload.bcc.join(", ") : payload.bcc;

        const info = await transporter.sendMail({
          from: payload.from,
          to,
          cc,
          bcc,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          replyTo: Array.isArray(payload.reply_to) ? payload.reply_to.join(", ") : payload.reply_to,
        });

        console.log(`[MockResend] Email sent successfully. MessageId: ${info.messageId}`);
        return { data: { id: info.messageId }, error: null };
      } catch (error: any) {
        console.error("[MockResend] Failed to send email via SMTP:", error);
        return { data: null, error: { message: error.message || "Failed to send email", name: "smtp_error" } };
      }
    },
  };
}

const apiKey = process.env.RESEND_API_KEY;
const isDummyKey = !apiKey || apiKey === "re_dummy_local" || apiKey === "re_your_resend_api_key" || apiKey.includes("dummy");

export const resend = isDummyKey
  ? (new MockResend() as unknown as Resend)
  : new Resend(apiKey);

