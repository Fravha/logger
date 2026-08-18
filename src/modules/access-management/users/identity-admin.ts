export interface CreateIdentityUserInput {
  uid: string;
  email: string;
  displayName?: string;
}

export interface IdentityAdmin {
  createUser(data: CreateIdentityUserInput): Promise<void>;
  updateUser(uid: string, data: { email?: string; displayName?: string | null }): Promise<void>;
  setDisabled(uid: string, disabled: boolean): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}
