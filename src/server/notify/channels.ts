import "server-only";
import webpush from "web-push";
import nodemailer from "nodemailer";
import { db } from "@/server/db";
import { env } from "@/server/env";

// ───────────────────────────── Web Push ─────────────────────────────

let vapidReady = false;
export function pushEnabled() {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    vapidReady = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
  // When set, the service worker shows Accept / Decline action buttons.
  donationRequestId?: string;
};

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!pushEnabled() || userIds.length === 0) return;
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: payload.urgent ? 3600 : 86_400, urgency: payload.urgent ? "high" : "normal" },
        );
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404/410: subscription expired or revoked — prune it.
        if (code === 404 || code === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.warn("[push] send failed", code ?? err);
        }
      }
    }),
  );
}

// ─────────────────────────────── Email ───────────────────────────────

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendEmail(to: string, subject: string, text: string) {
  if (!env.smtp.host) {
    console.info(`[email:console] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, text });
  } catch (err) {
    console.error("[email] send failed", err);
  }
}

// ──────────────────────────────── SMS ────────────────────────────────
// Provider-agnostic interface so SMS OTP / alerts can be switched on later
// (Twilio, a local BD gateway, WhatsApp…) without touching business logic.

export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, body: string) {
    console.info(`[sms:console] to=${to}\n${body}`);
  }
}

class TwilioSmsProvider implements SmsProvider {
  async send(to: string, body: string) {
    const { twilioSid, twilioToken, twilioFrom } = env.sms;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: twilioFrom, Body: body }),
    });
    if (!res.ok) console.error("[sms:twilio] send failed", res.status, await res.text().catch(() => ""));
  }
}

let sms: SmsProvider | null = null;
export function smsProvider(): SmsProvider {
  if (sms) return sms;
  sms =
    env.sms.provider === "twilio" && env.sms.twilioSid && env.sms.twilioToken
      ? new TwilioSmsProvider()
      : new ConsoleSmsProvider();
  return sms;
}

export async function sendSms(to: string, body: string) {
  try {
    await smsProvider().send(to, body);
  } catch (err) {
    console.error("[sms] send failed", err);
  }
}
