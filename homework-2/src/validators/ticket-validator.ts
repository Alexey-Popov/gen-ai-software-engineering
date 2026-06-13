import { z } from 'zod';
import { Category, Priority, Status, Source, DeviceType, Ticket, CreateTicketPayload, UpdateTicketPayload } from '../models/ticket';

const metadataSchema = z.object({
  source: z.nativeEnum(Source).optional(),
  browser: z.string().optional(),
  device_type: z.nativeEnum(DeviceType).optional(),
});

const createTicketSchema = z.object({
  customer_id: z.string().min(1, 'customer_id is required'),
  customer_email: z.string().email('Invalid email format'),
  customer_name: z.string().min(1, 'customer_name is required').max(200, 'customer_name must be at most 200 characters'),
  subject: z.string().min(1, 'subject is required').max(200, 'subject must be at most 200 characters'),
  description: z.string().min(10, 'description must be at least 10 characters').max(2000, 'description must be at most 2000 characters'),
  category: z.nativeEnum(Category, { errorMap: () => ({ message: `category must be one of: ${Object.values(Category).join(', ')}` }) }).nullish(),
  priority: z.nativeEnum(Priority, { errorMap: () => ({ message: `priority must be one of: ${Object.values(Priority).join(', ')}` }) }).nullish(),
  status: z.nativeEnum(Status, { errorMap: () => ({ message: `status must be one of: ${Object.values(Status).join(', ')}` }) }).optional(),
  assigned_to: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: metadataSchema.optional(),
});

const updateTicketSchema = z.object({
  customer_email: z.string().email('Invalid email format').optional(),
  customer_name: z.string().min(1, 'customer_name cannot be empty').max(200, 'customer_name must be at most 200 characters').optional(),
  subject: z.string().min(1, 'subject cannot be empty').max(200, 'subject must be at most 200 characters').optional(),
  description: z.string().min(10, 'description must be at least 10 characters').max(2000, 'description must be at most 2000 characters').optional(),
  category: z.nativeEnum(Category, { errorMap: () => ({ message: `category must be one of: ${Object.values(Category).join(', ')}` }) }).nullish(),
  priority: z.nativeEnum(Priority, { errorMap: () => ({ message: `priority must be one of: ${Object.values(Priority).join(', ')}` }) }).nullish(),
  status: z.nativeEnum(Status, { errorMap: () => ({ message: `status must be one of: ${Object.values(Status).join(', ')}` }) }).optional(),
  assigned_to: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: metadataSchema.optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

function formatZodErrors(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.errors.map(err => ({
    field: err.path.join('.') || 'unknown',
    message: err.message,
  }));
}

export function validateCreateTicket(data: unknown): CreateTicketPayload {
  const result = createTicketSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', formatZodErrors(result.error));
  }
  return result.data as CreateTicketPayload;
}

export function validateUpdateTicket(data: unknown, _current: Ticket): Partial<UpdateTicketPayload> {
  const result = updateTicketSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', formatZodErrors(result.error));
  }
  return result.data as Partial<UpdateTicketPayload>;
}

export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export function validateStringLength(str: string, min: number, max: number): boolean {
  return str.length >= min && str.length <= max;
}

export { createTicketSchema, updateTicketSchema };
