import { Router } from 'express';
import multer from 'multer';
import ticketStore from '../store/ticketStore.js';
import { validateTicketOrThrow, validateTicketPartialOrThrow } from '../validators/ticketValidator.js';
import { validateQueryFilters } from '../validators/queryValidator.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { parseCsvTickets } from '../parsers/csvParser.js';
import { parseJsonTickets } from '../parsers/jsonParser.js';
import { parseXmlTickets } from '../parsers/xmlParser.js';
import { importTickets } from '../services/importService.js';
import { classify } from '../classifier/classify.js';
import { record as recordDecision } from '../classifier/decisionLog.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

function detectFormat(file) {
  const name = (file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (name.endsWith('.csv') || mime.includes('csv')) return 'csv';
  if (name.endsWith('.json') || mime.includes('json')) return 'json';
  if (name.endsWith('.xml') || mime.includes('xml')) return 'xml';
  return null;
}

/**
 * Run the classifier on a ticket, persist the result on the ticket itself,
 * and append an entry to the decision log.
 *
 * @param {object} ticket   the existing stored ticket
 * @param {'auto-on-create' | 'manual'} trigger
 * @returns {{ updatedTicket: object, result: object }}
 */
function applyClassification(ticket, trigger) {
  const result = classify(ticket);
  const updatedTicket = ticketStore.update(ticket.id, {
    category: result.category,
    priority: result.priority,
    classification: {
      confidence: result.confidence,
      reasoning: result.reasoning,
      keywords: result.keywords,
      classified_at: new Date().toISOString(),
    },
  });
  recordDecision({
    ticket_id: ticket.id,
    subject: ticket.subject,
    result,
    trigger,
  });
  return { updatedTicket, result };
}

/**
 * POST /tickets/import — Bulk import tickets from CSV, JSON, or XML
 * Field name: "file" (multipart/form-data)
 */
router.post('/import', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError(['file is required (multipart/form-data field "file")']);
    }

    const format = detectFormat(req.file);
    if (format === null) {
      throw new ValidationError([
        'Unsupported file format; expected .csv, .json, or .xml',
      ]);
    }

    let parsed;
    try {
      if (format === 'csv') parsed = parseCsvTickets(req.file.buffer);
      else if (format === 'json') parsed = parseJsonTickets(req.file.buffer);
      else if (format === 'xml') parsed = parseXmlTickets(req.file.buffer);
    } catch (err) {
      throw new ValidationError([err.message]);
    }

    const summary = importTickets(parsed);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /tickets — Create a new ticket
 *   ?autoClassify=true  — run the classifier on creation and store category/priority
 */
router.post('/', (req, res, next) => {
  try {
    validateTicketOrThrow(req.body);
    let ticket = ticketStore.create(req.body);
    if (req.query.autoClassify === 'true') {
      ticket = applyClassification(ticket, 'auto-on-create').updatedTicket;
    }
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /tickets/:id/auto-classify — explicitly classify an existing ticket.
 * Updates `category`, `priority`, and the `classification` block on the ticket;
 * returns both the updated ticket and the classifier result.
 */
router.post('/:id/auto-classify', (req, res, next) => {
  try {
    const existing = ticketStore.getById(req.params.id);
    if (!existing) {
      throw new NotFoundError('Ticket not found');
    }
    const { updatedTicket, result } = applyClassification(existing, 'manual');
    res.json({ ticket: updatedTicket, classification: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /tickets — List tickets, with optional filtering
 *   ?category, ?priority, ?status, ?customer_id, ?assigned_to,
 *   ?from=YYYY-MM-DD, ?to=YYYY-MM-DD (or full ISO 8601)
 */
router.get('/', (req, res, next) => {
  try {
    const criteria = validateQueryFilters(req.query);
    const tickets = Object.keys(criteria).length === 0
      ? ticketStore.getAll()
      : ticketStore.filter(criteria);
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /tickets/:id — Get a ticket by ID
 */
router.get('/:id', (req, res, next) => {
  try {
    const ticket = ticketStore.getById(req.params.id);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /tickets/:id — Update a ticket (partial updates allowed)
 */
router.put('/:id', (req, res, next) => {
  try {
    validateTicketPartialOrThrow(req.body);
    const ticket = ticketStore.update(req.params.id, req.body);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /tickets/:id — Delete a ticket
 */
router.delete('/:id', (req, res, next) => {
  try {
    const deleted = ticketStore.delete(req.params.id);
    if (!deleted) {
      throw new NotFoundError('Ticket not found');
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
