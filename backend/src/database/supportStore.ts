import fs from 'fs';
import path from 'path';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
export type TicketCategory = 
  | 'CAMERA_HARDWARE' 
  | 'RADAR_LINK' 
  | 'TELEMETRY_ACCURACY' 
  | 'SOFTWARE_UI' 
  | 'FEEDBACK_SUGGESTION' 
  | 'GENERAL_QUERY';

export interface SupportTicket {
  id: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  role: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  adminResolution?: string;
  resolvedAt?: number;
  resolvedBy?: string;
}

export class SupportStore {
  private ticketsFile: string;
  private tickets: Map<string, SupportTicket> = new Map();

  constructor() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.ticketsFile = path.join(dataDir, 'support_tickets.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.ticketsFile)) {
        const raw = fs.readFileSync(this.ticketsFile, 'utf-8');
        const list: SupportTicket[] = JSON.parse(raw);
        list.forEach(t => this.tickets.set(t.id, t));
      }
    } catch (err) {
      console.error('[SupportStore] Error reading tickets storage:', err);
    }
  }

  private saveToDisk() {
    try {
      const list = Array.from(this.tickets.values());
      fs.writeFileSync(this.ticketsFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SupportStore] Error writing tickets storage:', err);
    }
  }

  public getAllTickets(): SupportTicket[] {
    return Array.from(this.tickets.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getTicketsByUser(email: string): SupportTicket[] {
    const clean = email.toLowerCase().trim();
    return this.getAllTickets().filter(t => t.customerEmail.toLowerCase().trim() === clean);
  }

  public createTicket(data: {
    customerName: string;
    customerEmail: string;
    role?: string;
    category: TicketCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
  }): SupportTicket {
    const id = 'TICK-' + Math.floor(1000 + Math.random() * 9000);
    const now = Date.now();
    const ticket: SupportTicket = {
      id,
      customerName: data.customerName || 'Hospital User',
      customerEmail: data.customerEmail || 'user@hospital.local',
      role: data.role || 'OPERATOR',
      category: data.category || 'GENERAL_QUERY',
      priority: data.priority || 'MEDIUM',
      subject: data.subject.trim(),
      description: data.description.trim(),
      status: 'PENDING',
      createdAt: now,
      updatedAt: now
    };

    this.tickets.set(id, ticket);
    this.saveToDisk();
    return ticket;
  }

  public resolveTicket(id: string, adminResolution: string, resolvedBy: string): SupportTicket | null {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;

    ticket.status = 'RESOLVED';
    ticket.adminResolution = adminResolution.trim();
    ticket.resolvedAt = Date.now();
    ticket.resolvedBy = resolvedBy || 'Administrator';
    ticket.updatedAt = Date.now();

    this.saveToDisk();
    return ticket;
  }

  public updateStatus(id: string, status: TicketStatus): SupportTicket | null {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;

    ticket.status = status;
    ticket.updatedAt = Date.now();
    this.saveToDisk();
    return ticket;
  }

  public deleteTicket(id: string): boolean {
    const deleted = this.tickets.delete(id);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  public getAnalytics() {
    const all = this.getAllTickets();
    const total = all.length;
    const pending = all.filter(t => t.status === 'PENDING').length;
    const inReview = all.filter(t => t.status === 'IN_REVIEW').length;
    const resolved = all.filter(t => t.status === 'RESOLVED').length;

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total,
      pending,
      inReview,
      resolved,
      resolutionRate
    };
  }
}

export const supportStore = new SupportStore();
