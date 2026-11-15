/** CG-01 transport-only types. Authoritative validation and enforcement remain on the backend. */
export interface CG01SignInRequest { email:string; password:string; totp:string; deviceLabel?:string }
export interface CG01SessionCreated { sessionToken:string; expiresAt:string; displayName:string }
export interface CG01SessionView { displayName:string; roleName:string; scope:"Foundation" }
export interface CG01SafeError { status:"error"; message:string; requestId:string }
