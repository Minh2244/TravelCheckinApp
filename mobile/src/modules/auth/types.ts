export type AuthUser = {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  role: "user" | "owner" | "employee" | "admin";
  avatar_url: string | null;
  is_verified: number | boolean;
};

export type AuthPayload = {
  success: boolean;
  message: string;
  warning?: string;
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    redirectUrl?: string;
  };
};

export type BasicResponse = {
  success: boolean;
  message: string;
};

export type SocialSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
