export interface AccountsPort {
  resolveAccountId(accessToken: string): Promise<string | null>
}
