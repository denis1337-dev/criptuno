type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

export const getTelegramInitData = (): string => {
  const webApp = (window as TelegramWindow).Telegram?.WebApp;
  webApp?.ready?.();
  return webApp?.initData ?? "";
};
