import { Router, Request, Response, NextFunction } from 'express';
import {
  createTicket,
  getTicket,
  getAllTickets,
  updateTicket,
  deleteTicket,
  FilterOptions,
} from '../services/ticket-service';
import { classifyTicket, logDecision } from '../services/classifier';
import { ValidationError } from '../validators/ticket-validator';
import { Category, Priority, Status } from '../models/ticket';

const router = Router();

router.post('/', (req: Request, res: Response, next: NextFunction): void => {
  try {
    let ticket = createTicket(req.body);

    if (req.query.auto_classify === 'true') {
      try {
        const result = classifyTicket(ticket);
        const updated = updateTicket(ticket.id, { category: result.category, priority: result.priority });
        if (updated) ticket = updated;
        logDecision(ticket.id, ticket, result);
      } catch (classifyErr) {
        console.error(`[AUTO-CLASSIFY] Failed for ticket ${ticket.id}:`, classifyErr);
      }
    }

    res.status(201).json(ticket);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({
        error: err.message,
        details: err.details,
        requestId: (req as any).requestId,
      });
      return;
    }
    next(err);
  }
});

router.get('/', (req: Request, res: Response): void => {
  const { category, priority, status, customer_id, assigned_to } = req.query;
  const filters: FilterOptions = {};
  if (category) filters.category = category as Category;
  if (priority) filters.priority = priority as Priority;
  if (status) filters.status = status as Status;
  if (customer_id) filters.customer_id = customer_id as string;
  if (assigned_to) filters.assigned_to = assigned_to as string;
  const tickets = getAllTickets(Object.keys(filters).length > 0 ? filters : undefined);
  res.json(tickets);
});

router.get('/:id', (req: Request, res: Response): void => {
  const ticket = getTicket(req.params.id);
  if (!ticket) {
    res.status(404).json({
      error: 'Ticket not found',
      details: [],
      requestId: (req as any).requestId,
    });
    return;
  }
  res.json(ticket);
});

router.put('/:id', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const ticket = updateTicket(req.params.id, req.body);
    if (!ticket) {
      res.status(404).json({
        error: 'Ticket not found',
        details: [],
        requestId: (req as any).requestId,
      });
      return;
    }
    res.json(ticket);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({
        error: err.message,
        details: err.details,
        requestId: (req as any).requestId,
      });
      return;
    }
    next(err);
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = deleteTicket(req.params.id);
  if (!deleted) {
    res.status(404).json({
      error: 'Ticket not found',
      details: [],
      requestId: (req as any).requestId,
    });
    return;
  }
  res.status(204).send();
});

router.post('/:id/auto-classify', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const ticket = getTicket(req.params.id);
    if (!ticket) {
      res.status(404).json({
        error: 'Ticket not found',
        details: [],
        requestId: (req as any).requestId,
      });
      return;
    }

    const result = classifyTicket(ticket);
    updateTicket(req.params.id, { category: result.category, priority: result.priority });
    logDecision(req.params.id, ticket, result);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
