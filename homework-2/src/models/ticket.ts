export enum Category {
  AccountAccess = 'account_access',
  TechnicalIssue = 'technical_issue',
  BillingQuestion = 'billing_question',
  FeatureRequest = 'feature_request',
  BugReport = 'bug_report',
  Other = 'other',
}

export enum Priority {
  Urgent = 'urgent',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum Status {
  New = 'new',
  InProgress = 'in_progress',
  WaitingCustomer = 'waiting_customer',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum Source {
  WebForm = 'web_form',
  Email = 'email',
  Api = 'api',
  Chat = 'chat',
  Phone = 'phone',
}

export enum DeviceType {
  Desktop = 'desktop',
  Mobile = 'mobile',
  Tablet = 'tablet',
}

export interface Metadata {
  source?: Source;
  browser?: string;
  device_type?: DeviceType;
}

export interface Ticket {
  id: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  assigned_to?: string;
  tags?: string[];
  metadata?: Metadata;
}

export interface CreateTicketPayload {
  customer_id: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  description: string;
  category: Category;
  priority: Priority;
  status?: Status;
  assigned_to?: string;
  tags?: string[];
  metadata?: Metadata;
}

export interface UpdateTicketPayload {
  customer_email?: string;
  customer_name?: string;
  subject?: string;
  description?: string;
  category?: Category;
  priority?: Priority;
  status?: Status;
  assigned_to?: string;
  tags?: string[];
  metadata?: Metadata;
}

export interface ImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: ImportRecordError[];
}

export interface ImportRecordError {
  recordIndex: number;
  errors: Record<string, string>;
}
