export interface AuthIdentity {
  uid: string;
  email?: string;
  authTime?: number;
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthIdentity>;
}
