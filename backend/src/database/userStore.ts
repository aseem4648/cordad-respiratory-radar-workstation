import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type UserRole = 'ADMIN' | 'RESEARCHER' | 'OPERATOR' | 'OBSERVER';
export type AccessTier = 'PERSONAL' | 'INSTITUTIONAL';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  tier: AccessTier;
  authProvider: 'PASSWORD' | 'GOOGLE' | 'INSTITUTIONAL';
  status: UserStatus;
  institutionId?: string;
  institutionName?: string;
  department?: string;
  createdAt: string;
  lastLogin: string | null;
  loginCount: number;
}

export interface AccessLogRecord {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  role: string;
  timestamp: number;
  timeString: string;
  eventType: 'SUCCESSFUL_LOGIN' | 'FAILED_LOGIN' | 'LOGOUT' | 'GOOGLE_AUTH_SUCCESS' | 'GOOGLE_AUTH_FAILED' | 'ACCOUNT_DISABLED' | 'ACCOUNT_ENABLED' | 'ACCOUNT_DELETED' | 'STALE_USERS_PURGED' | 'LOGS_CLEARED';
  authMethod: 'PASSWORD' | 'GOOGLE' | 'INSTITUTIONAL';
  status: 'SUCCESS' | 'FAILED';
  ipAddress: string;
  userAgent: string;
  details: string;
}

export class UserStore {
  private usersFile: string;
  private logsFile: string;
  private users: Map<string, UserRecord> = new Map();
  private logs: AccessLogRecord[] = [];

  constructor() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.usersFile = path.join(dataDir, 'users.json');
    this.logsFile = path.join(dataDir, 'access_logs.json');

    this.loadFromDisk();
    if (this.users.size === 0) {
      this.seedDefaultAccounts();
    }
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password + '_bme_salt_2026').digest('hex');
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.usersFile)) {
        const raw = fs.readFileSync(this.usersFile, 'utf-8');
        const list: UserRecord[] = JSON.parse(raw);
        list.forEach(u => this.users.set(u.email.toLowerCase(), u));
      }
      if (fs.existsSync(this.logsFile)) {
        const raw = fs.readFileSync(this.logsFile, 'utf-8');
        this.logs = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[UserStore] Error reading persistent storage:', err);
    }
  }

  private saveToDisk() {
    try {
      const userList = Array.from(this.users.values());
      fs.writeFileSync(this.usersFile, JSON.stringify(userList, null, 2), 'utf-8');
      fs.writeFileSync(this.logsFile, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (err) {
      console.error('[UserStore] Error writing persistent storage:', err);
    }
  }

  private seedDefaultAccounts() {
    const defaults: Array<{
      email: string;
      pass: string;
      name: string;
      role: UserRole;
      tier: AccessTier;
      dept: string;
      instId?: string;
    }> = [
      {
        email: 'admin@radar.local',
        pass: 'admin',
        name: 'Head of Department (Admin)',
        role: 'ADMIN',
        tier: 'INSTITUTIONAL',
        dept: 'Head of Biomedical Department & Telemetry Control',
        instId: 'HOSP-HEAD-01'
      },
      {
        email: 'lead.researcher@biomech.edu',
        pass: 'Admin@2026#BME',
        name: 'Dr. A. Sharma',
        role: 'ADMIN',
        tier: 'INSTITUTIONAL',
        dept: 'Cardiopulmonary Critical Care',
        instId: 'BME-ICU-RES-01'
      },
      {
        email: 'admin@biomech.edu',
        pass: 'Admin@2026#BME',
        name: 'Biomedical System Administrator',
        role: 'ADMIN',
        tier: 'INSTITUTIONAL',
        dept: 'Clinical Engineering & Technology Operations',
        instId: 'HOSP-ADMIN-01'
      },
      {
        email: 'operator@hospital.org',
        pass: 'RadarOps!24G',
        name: 'Clinical Operator Staff',
        role: 'OPERATOR',
        tier: 'INSTITUTIONAL',
        dept: 'Respiratory Care Unit',
        instId: 'HOSP-BEDSIDE-04'
      },
      {
        email: 'bme.student@university.edu',
        pass: 'Biomed2026!',
        name: 'Biomedical Research Fellow',
        role: 'RESEARCHER',
        tier: 'PERSONAL',
        dept: 'Department of Biomedical Engineering'
      },
      {
        email: 'aseem323711@sahrdaya.ac.in',
        pass: 'admin',
        name: 'Aseem K S (Head of Department)',
        role: 'ADMIN',
        tier: 'INSTITUTIONAL',
        dept: 'Biomedical Telemetry & ICU Monitoring Research Lab',
        instId: 'SAHRDAYA-BME-01'
      },
      {
        email: 'doctor@hospital.org',
        pass: 'HospitalPro@2026',
        name: 'Dr. Sarah Lin (Consultant Pulmonologist)',
        role: 'OPERATOR',
        tier: 'INSTITUTIONAL',
        dept: 'Respiratory Critical Care & Clinical Operations',
        instId: 'HOSP-CLINICAL-01'
      },
      {
        email: 'observer@public.demo',
        pass: 'Observer@2026',
        name: 'Public Observer (Guest Visitor)',
        role: 'OBSERVER',
        tier: 'PERSONAL',
        dept: 'Community Medical Observer'
      }
    ];

    const now = new Date().toISOString();
    for (const d of defaults) {
      const u: UserRecord = {
        id: crypto.randomUUID(),
        email: d.email.toLowerCase(),
        passwordHash: this.hashPassword(d.pass),
        name: d.name,
        role: d.role,
        tier: d.tier,
        authProvider: 'PASSWORD',
        status: 'ACTIVE',
        institutionId: d.instId,
        institutionName: 'Biomedical Engineering Clinical ICU Lab',
        department: d.dept,
        createdAt: now,
        lastLogin: null,
        loginCount: 0
      };
      this.users.set(u.email.toLowerCase(), u);
    }
    this.saveToDisk();
  }

  public getAllUsers(): Omit<UserRecord, 'passwordHash'>[] {
    return Array.from(this.users.values()).map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });
  }

  public getUserByEmail(email: string): UserRecord | undefined {
    const norm = email.toLowerCase().trim();
    if (!this.users.has(norm)) {
      this.loadFromDisk();
    }
    return this.users.get(norm);
  }

  public verifyPassword(email: string, password: string): boolean {
    const u = this.getUserByEmail(email);
    if (!u || u.status === 'DISABLED') return false;
    return u.passwordHash === this.hashPassword(password);
  }

  public recordLogin(email: string): UserRecord | null {
    const u = this.getUserByEmail(email);
    if (!u) return null;
    u.lastLogin = new Date().toISOString();
    u.loginCount = (u.loginCount || 0) + 1;
    this.saveToDisk();
    return u;
  }

  public registerUser(data: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    tier?: AccessTier;
    authProvider?: 'PASSWORD' | 'GOOGLE' | 'INSTITUTIONAL';
    department?: string;
    institutionId?: string;
  }): UserRecord {
    const emailKey = data.email.toLowerCase().trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@biomech.edu').toLowerCase();
    const assignedRole: UserRole = emailKey === adminEmail ? 'ADMIN' : (data.role || 'OPERATOR');

    const u: UserRecord = {
      id: crypto.randomUUID(),
      email: emailKey,
      passwordHash: this.hashPassword(data.password),
      name: data.name,
      role: assignedRole,
      tier: data.tier || 'PERSONAL',
      authProvider: data.authProvider || 'PASSWORD',
      status: 'ACTIVE',
      institutionId: data.institutionId,
      institutionName: 'Biomedical Clinical Station',
      department: data.department || 'Clinical Telemetry',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      loginCount: 1
    };

    this.users.set(emailKey, u);
    this.saveToDisk();
    return u;
  }

  public setUserStatus(email: string, status: UserStatus): boolean {
    const u = this.getUserByEmail(email);
    if (!u) return false;
    // Protect primary admin from disabling themselves
    if (u.role === 'ADMIN' && status === 'DISABLED') {
      const adminCount = Array.from(this.users.values()).filter(x => x.role === 'ADMIN' && x.status === 'ACTIVE').length;
      if (adminCount <= 1) return false;
    }
    u.status = status;
    this.saveToDisk();
    return true;
  }

  public setUserRole(email: string, role: UserRole): boolean {
    const u = this.getUserByEmail(email);
    if (!u) return false;
    u.role = role;
    this.saveToDisk();
    return true;
  }

  public deleteUser(email: string, adminEmail = 'aseem323711@sahrdaya.ac.in'): { success: boolean; error?: string } {
    const norm = email.toLowerCase().trim();
    if (norm === 'aseem323711@sahrdaya.ac.in') {
      return { success: false, error: 'Cannot delete the Head Administrator account (aseem323711@sahrdaya.ac.in).' };
    }
    const user = this.getUserByEmail(norm);
    if (!user) {
      return { success: false, error: 'User account not found.' };
    }

    this.users.delete(norm);
    this.saveToDisk();

    this.logAccessEvent({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      eventType: 'ACCOUNT_DELETED',
      authMethod: user.authProvider,
      status: 'SUCCESS',
      ipAddress: '127.0.0.1',
      userAgent: 'Station Admin Console',
      details: `Account and credentials permanently purged by Head Administrator (${adminEmail})`
    });

    return { success: true };
  }

  public purgeStaleUsers(preservedEmail = 'aseem323711@sahrdaya.ac.in'): { success: boolean; purgedCount: number; remainingUsers: Omit<UserRecord, 'passwordHash'>[] } {
    const preservedNorm = preservedEmail.toLowerCase().trim();
    let purgedCount = 0;

    for (const [key, user] of Array.from(this.users.entries())) {
      if (key !== preservedNorm && key !== 'aseem323711@sahrdaya.ac.in') {
        this.users.delete(key);
        purgedCount++;
      }
    }

    this.saveToDisk();

    this.logAccessEvent({
      userId: null,
      name: 'Head Administrator',
      email: preservedEmail,
      role: 'ADMIN',
      eventType: 'STALE_USERS_PURGED',
      authMethod: 'PASSWORD',
      status: 'SUCCESS',
      ipAddress: '127.0.0.1',
      userAgent: 'Station Admin Console',
      details: `Instantaneous clearance performed: ${purgedCount} old user accounts & credentials permanently erased. Active admin preserved.`
    });

    return {
      success: true,
      purgedCount,
      remainingUsers: this.getAllUsers()
    };
  }

  public clearAccessLogs(operatorEmail = 'aseem323711@sahrdaya.ac.in'): { success: boolean; clearedCount: number } {
    const clearedCount = this.logs.length;
    this.logs = [];
    this.saveToDisk();

    this.logAccessEvent({
      userId: null,
      name: 'Head Administrator',
      email: operatorEmail,
      role: 'ADMIN',
      eventType: 'LOGS_CLEARED',
      authMethod: 'PASSWORD',
      status: 'SUCCESS',
      ipAddress: '127.0.0.1',
      userAgent: 'Station Admin Console',
      details: `Audit history cleared by Administrator. ${clearedCount} previous audit entries purged.`
    });

    return { success: true, clearedCount };
  }

  // ==================== ACCESS EVENT LOGS ====================
  public logAccessEvent(event: Omit<AccessLogRecord, 'id' | 'timestamp' | 'timeString'>): AccessLogRecord {
    const now = Date.now();
    const record: AccessLogRecord = {
      id: `EVT-${now}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      timestamp: now,
      timeString: new Date(now).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      ...event
    };

    this.logs.unshift(record);
    // Keep last 500 genuine logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }
    this.saveToDisk();
    return record;
  }

  public getAccessLogs(limit = 100): AccessLogRecord[] {
    return this.logs.slice(0, limit);
  }

  public exportLogsCsv(): string {
    const header = 'Event ID,Timestamp,Name,Email,Role,Event Type,Auth Method,Status,IP Address,Details\n';
    const rows = this.logs.map(l => {
      return `"${l.id}","${l.timeString}","${l.name}","${l.email}","${l.role}","${l.eventType}","${l.authMethod}","${l.status}","${l.ipAddress}","${l.details.replace(/"/g, '""')}"`;
    }).join('\n');
    return header + rows;
  }
}

export const userStore = new UserStore();
