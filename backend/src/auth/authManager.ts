import crypto from 'crypto';
import https from 'https';
import { userStore, UserRole, AccessTier, UserRecord } from '../database/userStore';

export { UserRole, AccessTier, UserRecord };

export interface UserSession {
  isAuthenticated: boolean;
  tier: AccessTier;
  email: string;
  name: string;
  role: UserRole;
  institutionId?: string;
  institutionName?: string;
  department?: string;
  token: string;
  loginTime: number;
  lastActiveTime: number;
  sessionTimeoutMinutes: number;
}

export class AuthManager {
  // CRITICAL SECURITY ENFORCEMENT: Default session is strictly unauthenticated
  private activeSession: UserSession = {
    isAuthenticated: false,
    tier: 'PERSONAL',
    email: '',
    name: 'Unauthenticated User',
    role: 'OBSERVER',
    token: '',
    loginTime: 0,
    lastActiveTime: 0,
    sessionTimeoutMinutes: 30
  };

  private sessionsByToken: Map<string, UserSession> = new Map();
  private pendingOtpMap = new Map<string, { otp: string; expiresAt: number; data: any }>();

  public getSession(): UserSession {
    return { ...this.activeSession };
  }

  public getSessionByToken(token: string): UserSession | null {
    if (!token) return null;
    const s = this.sessionsByToken.get(token);
    if (!s) return null;
    // Check 30-min timeout
    if (Date.now() - s.lastActiveTime > s.sessionTimeoutMinutes * 60 * 1000) {
      this.sessionsByToken.delete(token);
      if (this.activeSession.token === token) {
        this.logout();
      }
      return null;
    }
    s.lastActiveTime = Date.now();
    return s;
  }

  public login(
    email: string,
    password: string,
    ipAddress = '127.0.0.1',
    userAgent = 'Clinical Station Browser'
  ): { success: boolean; error?: string; session?: UserSession } {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    const emailNorm = email.toLowerCase().trim();
    const user = userStore.getUserByEmail(emailNorm);

    if (!user) {
      userStore.logAccessEvent({
        userId: null,
        name: 'Unknown Operator',
        email: emailNorm,
        role: 'OBSERVER',
        eventType: 'FAILED_LOGIN',
        authMethod: 'PASSWORD',
        status: 'FAILED',
        ipAddress,
        userAgent,
        details: 'User account not registered in biomedical station.'
      });
      return { success: false, error: 'Invalid email address or user not registered in biomedical station.' };
    }

    if (user.status === 'DISABLED') {
      userStore.logAccessEvent({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        eventType: 'FAILED_LOGIN',
        authMethod: 'PASSWORD',
        status: 'FAILED',
        ipAddress,
        userAgent,
        details: 'Account disabled by system administrator.'
      });
      return { success: false, error: 'Account has been disabled by station administrator.' };
    }

    const valid = userStore.verifyPassword(emailNorm, password);
    if (!valid) {
      userStore.logAccessEvent({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        eventType: 'FAILED_LOGIN',
        authMethod: 'PASSWORD',
        status: 'FAILED',
        ipAddress,
        userAgent,
        details: 'Invalid password credentials provided.'
      });
      return { success: false, error: 'Invalid password. Please verify your credentials.' };
    }

    // Update login timestamp & counter
    userStore.recordLogin(emailNorm);

    // Authenticated session established
    const token = 'jwt_bme_' + crypto.randomBytes(24).toString('hex');
    this.activeSession = {
      isAuthenticated: true,
      tier: user.tier,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionId: user.institutionId,
      institutionName: user.institutionName,
      department: user.department,
      token,
      loginTime: Date.now(),
      lastActiveTime: Date.now(),
      sessionTimeoutMinutes: 60
    };

    this.sessionsByToken.set(token, { ...this.activeSession });

    userStore.logAccessEvent({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      eventType: 'SUCCESSFUL_LOGIN',
      authMethod: 'PASSWORD',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      details: `Authenticated as ${user.role} (${user.department || 'Clinical Telemetry'})`
    });

    return { success: true, session: this.getSession() };
  }

  public register(
    data: {
      email: string;
      password: string;
      name: string;
      role?: UserRole;
      tier?: AccessTier;
      institutionId?: string;
      institutionName?: string;
      department?: string;
    },
    ipAddress = '127.0.0.1',
    userAgent = 'Clinical Station Browser'
  ): { success: boolean; error?: string; session?: UserSession } {
    const emailKey = data.email.toLowerCase().trim();
    if (userStore.getUserByEmail(emailKey)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const newUser = userStore.registerUser({
      email: emailKey,
      password: data.password,
      name: data.name || emailKey.split('@')[0],
      role: data.role,
      tier: data.tier,
      department: data.department,
      institutionId: data.institutionId
    });

    return this.login(data.email, data.password, ipAddress, userAgent);
  }

  public requestOtp(email: string, tier: AccessTier, data: any): { success: boolean; error?: string; testOtp?: string } {
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

    const otp = crypto.randomInt(100000, 999999).toString();
    this.pendingOtpMap.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      data: { ...data, tier, email }
    });

    console.log(`\n========================================`);
    console.log(`[EMAIL OTP VERIFICATION CODE DISPATCH]`);
    console.log(`Recipient: ${email}`);
    console.log(`Passcode (OTP): ${otp}`);
    console.log(`Role Requested: ${data?.role || 'OBSERVER'}`);
    console.log(`Valid: 10 minutes`);
    console.log(`========================================\n`);

    return { 
      success: true, 
      testOtp: otp 
    };
  }

  public verifyOtp(
    email: string,
    otp: string,
    ipAddress = '127.0.0.1',
    userAgent = 'Clinical Station Browser'
  ): { success: boolean; error?: string; session?: UserSession } {
    const record = this.pendingOtpMap.get(email.toLowerCase());
    if (!record) {
      return { success: false, error: 'No active OTP verification code found for this email. Request a new one.' };
    }

    if (Date.now() > record.expiresAt) {
      this.pendingOtpMap.delete(email.toLowerCase());
      return { success: false, error: 'Verification code has expired.' };
    }

    if (record.otp !== otp.trim()) {
      return { success: false, error: 'Invalid verification passcode. Authentication failed.' };
    }

    const { data } = record;
    let user = userStore.getUserByEmail(email);
    if (!user) {
      const assignedRole: UserRole = data?.role === 'OPERATOR' ? 'OPERATOR' : (data?.role === 'ADMIN' ? 'ADMIN' : 'OBSERVER');
      user = userStore.registerUser({
        email,
        password: crypto.randomBytes(16).toString('hex'),
        name: data.name || email.split('@')[0],
        role: assignedRole,
        tier: data.tier || (assignedRole === 'OBSERVER' ? 'PERSONAL' : 'INSTITUTIONAL'),
        department: data.department || (assignedRole === 'OPERATOR' ? 'Hospital Medical Staff' : 'Public Observer'),
        institutionId: data.institutionId
      });
    }

    const token = 'jwt_bme_' + crypto.randomBytes(24).toString('hex');
    this.activeSession = {
      isAuthenticated: true,
      tier: user.tier,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionId: user.institutionId,
      institutionName: user.institutionName,
      department: user.department,
      token,
      loginTime: Date.now(),
      lastActiveTime: Date.now(),
      sessionTimeoutMinutes: 60
    };

    this.sessionsByToken.set(token, { ...this.activeSession });

    userStore.logAccessEvent({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      eventType: 'SUCCESSFUL_LOGIN',
      authMethod: 'INSTITUTIONAL',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      details: `Institutional OTP verified for ${user.email}`
    });

    this.pendingOtpMap.delete(email.toLowerCase());
    return { success: true, session: this.getSession() };
  }

  // Real Google OIDC Verification via Google tokeninfo endpoint
  public async handleGoogleAuth(
    credential?: string,
    ipAddress = '127.0.0.1',
    userAgent = 'Clinical Station Browser'
  ): Promise<{ success: boolean; error?: string; session?: UserSession; isConfigured?: boolean }> {
    const configuredClientId = process.env.GOOGLE_CLIENT_ID;

    if (!configuredClientId) {
      userStore.logAccessEvent({
        userId: null,
        name: 'Google Auth Attempt',
        email: 'unconfigured@google.auth',
        role: 'OBSERVER',
        eventType: 'GOOGLE_AUTH_FAILED',
        authMethod: 'GOOGLE',
        status: 'FAILED',
        ipAddress,
        userAgent,
        details: 'GOOGLE_CLIENT_ID not configured in backend .env'
      });

      return {
        success: false,
        isConfigured: false,
        error: 'Google Sign-In is not configured on this server (GOOGLE_CLIENT_ID missing in backend .env). Please sign in using your biomedical station credentials or consult the setup assistant.'
      };
    }

    if (!credential) {
      return { success: false, error: 'Google credential ID token is missing.', isConfigured: true };
    }

    try {
      // Real verification request to Google tokeninfo endpoint
      const googleUser = await new Promise<{ email: string; name: string; aud: string }>((resolve, reject) => {
        const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
        https.get(url, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.error_description || parsed.error) {
                reject(new Error(parsed.error_description || parsed.error));
              } else {
                resolve({
                  email: parsed.email,
                  name: parsed.name || parsed.email.split('@')[0],
                  aud: parsed.aud
                });
              }
            } catch (e) {
              reject(new Error('Invalid response from Google OAuth server'));
            }
          });
        }).on('error', (err) => {
          reject(err);
        });
      });

      if (googleUser.aud !== configuredClientId) {
        throw new Error('Google OAuth token audience does not match this station client ID');
      }

      const email = googleUser.email.toLowerCase();
      let user = userStore.getUserByEmail(email);

      if (!user) {
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@biomech.edu').toLowerCase();
        const role: UserRole = email === adminEmail ? 'ADMIN' : 'RESEARCHER';
        user = userStore.registerUser({
          email,
          password: crypto.randomBytes(24).toString('hex'),
          name: googleUser.name,
          role,
          tier: 'PERSONAL',
          authProvider: 'GOOGLE',
          department: 'Biomedical Sensing Research'
        });
      }

      if (user.status === 'DISABLED') {
        userStore.logAccessEvent({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          eventType: 'GOOGLE_AUTH_FAILED',
          authMethod: 'GOOGLE',
          status: 'FAILED',
          ipAddress,
          userAgent,
          details: 'Google login rejected: Account disabled by administrator.'
        });
        return { success: false, error: 'Account has been disabled by station administrator.' };
      }

      userStore.recordLogin(email);

      const token = 'jwt_bme_' + crypto.randomBytes(24).toString('hex');
      this.activeSession = {
        isAuthenticated: true,
        tier: user.tier,
        email: user.email,
        name: user.name,
        role: user.role,
        institutionId: user.institutionId,
        institutionName: user.institutionName,
        department: user.department,
        token,
        loginTime: Date.now(),
        lastActiveTime: Date.now(),
        sessionTimeoutMinutes: 60
      };

      this.sessionsByToken.set(token, { ...this.activeSession });

      userStore.logAccessEvent({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        eventType: 'GOOGLE_AUTH_SUCCESS',
        authMethod: 'GOOGLE',
        status: 'SUCCESS',
        ipAddress,
        userAgent,
        details: `Google OAuth Verified for ${user.email} (Role: ${user.role})`
      });

      return { success: true, session: this.getSession() };
    } catch (err: any) {
      userStore.logAccessEvent({
        userId: null,
        name: 'Google User',
        email: 'unknown',
        role: 'OBSERVER',
        eventType: 'GOOGLE_AUTH_FAILED',
        authMethod: 'GOOGLE',
        status: 'FAILED',
        ipAddress,
        userAgent,
        details: `Google verification error: ${err.message}`
      });

      return {
        success: false,
        isConfigured: true,
        error: `Google authentication verification failed: ${err.message}`
      };
    }
  }

  public logout(ipAddress = '127.0.0.1', userAgent = 'Clinical Station Browser'): void {
    if (this.activeSession.isAuthenticated) {
      const user = userStore.getUserByEmail(this.activeSession.email);
      userStore.logAccessEvent({
        userId: user?.id || null,
        name: this.activeSession.name,
        email: this.activeSession.email,
        role: this.activeSession.role,
        eventType: 'LOGOUT',
        authMethod: 'PASSWORD',
        status: 'SUCCESS',
        ipAddress,
        userAgent,
        details: 'Operator successfully logged out of clinical station.'
      });
      if (this.activeSession.token) {
        this.sessionsByToken.delete(this.activeSession.token);
      }
    }

    this.activeSession = {
      isAuthenticated: false,
      tier: 'PERSONAL',
      email: '',
      name: 'Unauthenticated User',
      role: 'OBSERVER',
      token: '',
      loginTime: 0,
      lastActiveTime: 0,
      sessionTimeoutMinutes: 30
    };
  }

  public touchActivity(token?: string): void {
    this.activeSession.lastActiveTime = Date.now();
    if (token && this.sessionsByToken.has(token)) {
      const s = this.sessionsByToken.get(token)!;
      s.lastActiveTime = Date.now();
    }
  }

  public clearAllSessionsExcept(preservedToken?: string, preservedEmail = 'aseem323711@sahrdaya.ac.in'): number {
    let invalidated = 0;
    const preservedNorm = preservedEmail?.toLowerCase().trim();

    for (const [token, sess] of Array.from(this.sessionsByToken.entries())) {
      const isPreserved = (preservedToken && token === preservedToken) ||
                          (preservedNorm && sess.email?.toLowerCase().trim() === preservedNorm);
      if (!isPreserved) {
        this.sessionsByToken.delete(token);
        invalidated++;
      }
    }

    if (this.activeSession.isAuthenticated) {
      const isPreserved = (preservedToken && this.activeSession.token === preservedToken) ||
                          (preservedNorm && this.activeSession.email?.toLowerCase().trim() === preservedNorm);
      if (!isPreserved) {
        this.activeSession = {
          isAuthenticated: false,
          tier: 'PERSONAL',
          email: '',
          name: 'Unauthenticated User',
          role: 'OBSERVER',
          token: '',
          loginTime: 0,
          lastActiveTime: 0,
          sessionTimeoutMinutes: 30
        };
        invalidated++;
      }
    }

    return invalidated;
  }

  public revokeUserSessions(email: string): number {
    const norm = email.toLowerCase().trim();
    let count = 0;

    for (const [token, sess] of Array.from(this.sessionsByToken.entries())) {
      if (sess.email?.toLowerCase().trim() === norm) {
        this.sessionsByToken.delete(token);
        count++;
      }
    }

    if (this.activeSession.email?.toLowerCase().trim() === norm) {
      this.activeSession = {
        isAuthenticated: false,
        tier: 'PERSONAL',
        email: '',
        name: 'Unauthenticated User',
        role: 'OBSERVER',
        token: '',
        loginTime: 0,
        lastActiveTime: 0,
        sessionTimeoutMinutes: 30
      };
      count++;
    }

    return count;
  }
}

export const authManager = new AuthManager();
