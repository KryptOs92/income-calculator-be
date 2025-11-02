const SUPPORTED_LOCALES = ["it", "en"];
const defaultLocaleEnv = (process.env.DEFAULT_LOCALE || "it").toLowerCase();
const FALLBACK_LOCALE = SUPPORTED_LOCALES.includes(defaultLocaleEnv)
  ? defaultLocaleEnv
  : "it";

const normalizeLocale = localeInput => {
  if (!localeInput || typeof localeInput !== "string") {
    return FALLBACK_LOCALE;
  }

  const lowered = localeInput.trim().toLowerCase();
  if (SUPPORTED_LOCALES.includes(lowered)) {
    return lowered;
  }

  const [primary] = lowered.split(/[-_]/);
  if (SUPPORTED_LOCALES.includes(primary)) {
    return primary;
  }

  return FALLBACK_LOCALE;
};

const EMAIL_TEMPLATES = {
  accountVerification: {
    it: ({ name, verificationLink }) => ({
      subject: "Conferma la tua registrazione",
      text: `Ciao ${name},\n\nPer completare la registrazione clicca sul link: ${verificationLink}\n\nSe non hai richiesto questo account, ignora questa email.`,
      html: `<p>Ciao ${name},</p><p>Per completare la registrazione clicca sul seguente link:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>Se non hai richiesto questo account, ignora questa email.</p>`,
    }),
    en: ({ name, verificationLink }) => ({
      subject: "Confirm your registration",
      text: `Hi ${name},\n\nTo finish signing up, click this link: ${verificationLink}\n\nIf you did not create this account, please ignore this email.`,
      html: `<p>Hi ${name},</p><p>To finish signing up, click the link below:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>If you did not create this account, please ignore this email.</p>`,
    }),
  },
  passwordReset: {
    it: ({ name, resetLink }) => ({
      subject: "Reset della password",
      text: `Ciao ${name},\n\nPer reimpostare la password clicca sul link: ${resetLink}\nQuesto link scadrà tra 1 ora.\n\nSe non hai richiesto il reset, ignora questa email.`,
      html: `<p>Ciao ${name},</p><p>Per reimpostare la password clicca sul seguente link (valido 1 ora):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Se non hai richiesto il reset, ignora questa email.</p>`,
    }),
    en: ({ name, resetLink }) => ({
      subject: "Reset your password",
      text: `Hi ${name},\n\nTo reset your password, click this link: ${resetLink}\nThis link expires in 1 hour.\n\nIf you did not request this change, you can safely ignore this email.`,
      html: `<p>Hi ${name},</p><p>To reset your password, use the link below (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this change, you can safely ignore this email.</p>`,
    }),
  },
};

export const resolveLocale = localeInput => normalizeLocale(localeInput);

export const buildAccountVerificationEmail = ({ locale, name, verificationLink }) => {
  const resolvedLocale = resolveLocale(locale);
  return EMAIL_TEMPLATES.accountVerification[resolvedLocale]({ name, verificationLink });
};

export const buildPasswordResetEmail = ({ locale, name, resetLink }) => {
  const resolvedLocale = resolveLocale(locale);
  return EMAIL_TEMPLATES.passwordReset[resolvedLocale]({ name, resetLink });
};
