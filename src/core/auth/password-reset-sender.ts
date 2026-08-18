export interface PasswordResetSender {
  send(email: string): Promise<void>;
}
