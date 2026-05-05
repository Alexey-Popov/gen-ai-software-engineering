import { Router } from 'express';
import ticketStore from '../store/ticketStore.js';
import { validateTicketOrThrow, validateTicketPartialOrThrow } from '../validators/ticketValidator.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();

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
