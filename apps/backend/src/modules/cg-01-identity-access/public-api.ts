// Only this stable, CG-01-owned contract is available to later modules.
export type VerifiedFoundationActor = Readonly<{
  accountId: string;
  realmId: string;
  displayName: string;
  roleName: string;
  activeSessionId: string;
  mfaVerifiedAt: Date;
}>;
export interface IdentityAuthorization {
  verifySession(bearer: string): Promise<VerifiedFoundationActor>;
  requireAction(bearer: string, capability: string): Promise<VerifiedFoundationActor>;
}
