import nodemailer from "nodemailer";

let cachedTransporter = null;

const createTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE = "false",
    EMAIL_FROM,
  } = process.env;

  if (SMTP_HOST && SMTP_PORT) {
    const transportConfig = {
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === "true",
    };

    if (SMTP_USER && SMTP_PASS) {
      transportConfig.auth = {
        user: SMTP_USER,
        pass: SMTP_PASS,
      };
    }

    cachedTransporter = nodemailer.createTransport(transportConfig);

    cachedTransporter.verify().catch(err => {
      console.warn("SMTP transporter verification failed:", err?.message || err);
    });
  } else {
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true,
    });

    if (!EMAIL_FROM) {
      console.warn(
        "SMTP configuration missing. Emails will be logged to console. Set EMAIL_FROM and SMTP_* env vars for real delivery.",
      );
    }
  }

  return cachedTransporter;
};

export const sendMail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || "no-reply@example.com";

  const info = await transporter.sendMail({ from, to, subject, text, html });

  if (transporter.options.jsonTransport) {
    console.info("Email payload:", info.message);
  }

  return info;
};
