export interface IBillingWhitelist {
  isEmailAllowed(email: string): Promise<boolean>;
}
