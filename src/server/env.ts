import "server-only";

const isProd = process.env.NODE_ENV === "production";

function required(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  return devFallback;
}

export const env = {
  isProd,
  appUrl: process.env.APP_URL || "http://localhost:3000",
  get jwtSecret() {
    const s = required("JWT_SECRET", "dev-only-insecure-jwt-secret-change-me-please-32chars");
    if (isProd && s.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
    return s;
  },
  sessionDays: Number(process.env.SESSION_DAYS || 7),
  cronSecret: process.env.CRON_SECRET || (isProd ? "" : "dev-cron-secret"),
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@lifedrop.local",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "LifeDrop <no-reply@lifedrop.local>",
  },
  sms: {
    provider: process.env.SMS_PROVIDER || "console", // console | twilio (future: others)
    twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
    twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
    twilioFrom: process.env.TWILIO_FROM_NUMBER || "",
  },
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  /** In development, API responses include verification links / OTPs so the flows are testable without SMTP/SMS. */
  exposeDevSecrets: !isProd && process.env.EXPOSE_DEV_SECRETS !== "false",
  runJobsInProcess: process.env.RUN_JOBS_IN_PROCESS !== "false",
};
