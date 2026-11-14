import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

interface TransporterCacheItem {
  transporter: Transporter;
  user: string;
  pass: string;
}

const transporterPool = new Map<string, TransporterCacheItem>();

let defaultTransporter: Transporter | null = null;
let defaultCredentials: { user: string; pass: string } | null = null;

/**
 * Initializes or fetches a cached transporter for a specific sender
 */
export async function getTransporterForSender(senderEmail: string): Promise<Transporter> {
  const normalizedSender = senderEmail.trim().toLowerCase();

  if (transporterPool.has(normalizedSender)) {
    return transporterPool.get(normalizedSender)!.transporter;
  }

  // If specific env credentials are provided and match default
  if (!defaultTransporter) {
    let user = process.env.ETH_USER;
    let pass = process.env.ETH_PASS;
    const host = process.env.ETH_HOST || 'smtp.ethereal.email';
    const port = parseInt(process.env.ETH_PORT || '587', 10);

    if (!user || !pass) {
      console.log(`[Mailer] Generating new Ethereal test account for default sender...`);
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      defaultCredentials = { user, pass };
      console.log(`[Mailer] Generated Ethereal Account: ${user}`);
    } else {
      defaultCredentials = { user, pass };
    }

    defaultTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      await defaultTransporter.verify();
      console.log(`[Mailer] SMTP connection verified for ${user}`);
    } catch (e: any) {
      console.warn(`[Mailer Warning] SMTP verification failed:`, e.message);
    }

    transporterPool.set('default', {
      transporter: defaultTransporter,
      user,
      pass,
    });
  }

  // Create or reuse for sender
  if (normalizedSender && !transporterPool.has(normalizedSender)) {
    // Generate isolated credentials for this unique sender if needed
    try {
      const testAccount = await nodemailer.createTestAccount();
      const host = process.env.ETH_HOST || 'smtp.ethereal.email';
      const port = parseInt(process.env.ETH_PORT || '587', 10);
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      transporterPool.set(normalizedSender, {
        transporter,
        user: testAccount.user,
        pass: testAccount.pass,
      });
      console.log(`[Mailer] Created isolated Ethereal SMTP account for sender: ${normalizedSender} (${testAccount.user})`);
      return transporter;
    } catch (err: any) {
      console.warn(`[Mailer] Fallback to default transporter for ${normalizedSender}: ${err.message}`);
      return defaultTransporter;
    }
  }

  return defaultTransporter;
}

export interface SendMailParams {
  from?: string;
  to: string;
  subject: string;
  body: string;
}

export async function sendMail({ from, to, subject, body }: SendMailParams) {
  const sender = from || 'outbox-agent-1@reachinbox.ai';
  const transporter = await getTransporterForSender(sender);

  const mailOptions = {
    from: `ReachInbox <${sender}>`,
    to,
    subject,
    text: body.replace(/<[^>]*>?/gm, ''),
    html: body,
  };

  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  return {
    messageId: info.messageId,
    previewUrl,
    sender,
  };
}

export function getDefaultCredentials() {
  return defaultCredentials;
}
