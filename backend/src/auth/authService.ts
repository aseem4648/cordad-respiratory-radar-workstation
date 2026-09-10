/**
 * Contactless Respiratory Radar Authentication & RBAC Service
 * 
 * Rules:
 * - Designated Admin Email: aseem323711@sahrdaya.ac.in
 * - Strict gating: Unauthenticated requests require valid login credentials
 * - Administrative RBAC: Only designated admin has privileges to alter sensor registers,
 *   network endpoints, tuning profiles, and purge stale users.
 */

import { authManager } from './authManager';
import { userStore, UserRole, UserRecord } from '../database/userStore';

export const DESIGNATED_ADMIN_EMAIL = 'aseem323711@sahrdaya.ac.in';

export class AuthService {
  /**
   * Validates whether an email belongs to the primary system administrator
   */
  public isAdminEmail(email: string): boolean {
    if (!email) return false;
    return email.trim().toLowerCase() === DESIGNATED_ADMIN_EMAIL.toLowerCase();
  }

  /**
   * Check if a token has admin privileges
   */
  public isAdminToken(token?: string): boolean {
    if (!token) return false;
    const session = authManager.getSessionByToken(token);
    if (!session || !session.isAuthenticated) return false;
    return session.role === 'ADMIN' || this.isAdminEmail(session.email);
  }

  /**
   * Perform authentication
   */
  public login(email: string, password?: string, ip?: string) {
    return authManager.login(email, password || '', ip);
  }

  /**
   * Get active session
   */
  public getSession() {
    return authManager.getSession();
  }

  /**
   * Get session by token
   */
  public getSessionByToken(token: string) {
    return authManager.getSessionByToken(token);
  }

  /**
   * Purge stale users and hanging credentials while preserving the designated admin
   */
  public purgeStaleUsers(token?: string) {
    const session = token ? authManager.getSessionByToken(token) : authManager.getSession();
    const preservedEmail = session?.email || DESIGNATED_ADMIN_EMAIL;

    const purgeResult = userStore.purgeStaleUsers(preservedEmail);
    const invalidatedSessions = authManager.clearAllSessionsExcept(token, preservedEmail);

    return {
      success: true,
      purgedCount: purgeResult.purgedCount,
      invalidatedSessions,
      users: purgeResult.remainingUsers
    };
  }
}

export const authService = new AuthService();
