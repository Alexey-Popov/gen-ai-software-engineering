import { Router } from 'express';
import multer from 'multer';
import ticketStore from '../store/ticketStore.js';
import { validateTicketOrThrow, validateTicketPartialOrThrow } from '../validators/ticketValidator.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { parseCsvTickets } from '../parsers/csvParser.js';
import { parseJsonTickets } from '../parsers/jsonParser.js';
import { importTickets } from '../services/importService.js';

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
 * POST /tickets/import — Bulk import tickets from CSV or JSON (XML in Stage 6)
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
        'Unsupported file format; expected .csv, .json (.xml coming in Stage 6)',
      ]);
    }

    let parsed;
    try {
      if (format === 'csv') {
        parsed = parseCsvTickets(req.file.buffer);
      } else if (format === 'json') {
        parsed = parseJsonTickets(req.file.buffer);
      } else {
        throw new Error(`${format.toUpperCase()} import is not implemented yet`);
      }
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
 */
router.post('/', (req, res, next) => {
  try {
    validateTicketOrThrow(req.body);
    const ticket = ticketStore.create(req.body);
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /tickets — List all tickets
 */
router.get('/', (req, res, next) => {
  try {
    const tickets = ticketStore.getAll();
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
