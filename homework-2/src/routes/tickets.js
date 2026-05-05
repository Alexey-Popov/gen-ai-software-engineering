import { Router } from 'express';
import ticketStore from '../store/ticketStore.js';

const router = Router();

/**
 * POST /tickets — Create a new ticket
 */
router.post('/', (req, res, next) => {
  try {
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
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /tickets/:id — Update a ticket
 */
router.put('/:id', (req, res, next) => {
  try {
    const ticket = ticketStore.update(req.params.id, req.body);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
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
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
