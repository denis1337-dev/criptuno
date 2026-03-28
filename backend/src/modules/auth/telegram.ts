import crypto from "crypto";

const buildDataCheckString = (initData: string): string => {
  const params = new URLSearchParams(initData);
  const entries = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  return entries.join("\n");
};

export const verifyTelegramInitData = (initData: string, botToken: string): boolean => {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return false;
  }

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const dataCheckString = buildDataCheckString(initData);
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return calculated === hash;
};

export type TelegramUser = {
  id: number;
  first_name: string;
  username?: string;
};

export const extractTelegramUser = (initData: string): TelegramUser | null => {
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  if (!userRaw) {
    return null;
  }

  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
};
