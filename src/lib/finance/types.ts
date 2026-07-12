export type TelegramUser = {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
};

export type Profile = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type TelegramAuthResponse = {
  access_token: string;
  refresh_token: string;
};
