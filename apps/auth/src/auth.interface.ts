export interface RegisterResult {
  userId: string;
  email: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ValidateTokenUserInfo {
  userId: string;
  email: string;
  roles: string[];
  tokenExp: number;
  tokenHash: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  user: ValidateTokenUserInfo | undefined;
  errorMessage: string;
}

export type RefreshTokenResult = LoginResult;
