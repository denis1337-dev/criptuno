type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

export const getTelegramInitData = (): string => {
  const webApp = (window as TelegramWindow).Telegram?.WebApp;
  if (webApp) {
    webApp.ready?.();
    webApp.expand?.();
  }
  return webApp?.initData ?? "";
};

export const isTelegramWebApp = (): boolean => {
  return !!(window as TelegramWindow).Telegram?.WebApp;
};
