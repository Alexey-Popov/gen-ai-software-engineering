const express = require('express');
const router = express.Router();
const Ticket = require('../models/ticket');
const storage = require('../storage/inMemoryStorage');
const { validateTicket } = require('../validators/ticketValidator');
const { parseCSVFile } = require('../parsers/csvParser');
const { parseJSONFile } = require('../parsers/jsonParser');
const { parseXMLFile } = require('../parsers/xmlParser');
const { detectFileFormat } = require('../utils/helpers');
const { classifyTicket } = require('../classification/autoClassifier');

/**
 * POST /tickets - Create a new ticket
 * Creates a single support ticket with validation.
 */
router.post('/', (req, res) => {
  try {
    const validation = validateTicket(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const ticket = new Ticket(req.body);
    storage.addTicket(ticket);

    return res.status(201).json(ticket.toJSON());
  } catch (error) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create ticket'
    });
  }
});

/**
 * POST /tickets/import - Bulk import tickets from CSV, JSON, or XML
 * Detects format and parses file, returning summary of success/failures.
 */
router.post('/import', async (req, res) => {
  try {
    const buffer = req.body;
    const contentType = req.get('Content-Type');
    const format = detectFileFormat(contentType, buffer);

    let result;
    switch (format) {
    case 'csv':
      result = await parseCSVFile(buffer);
      break;
    case 'json':
      result = await parseJSONFile(buffer);
      break;
    case 'xml':
      result = await parseXMLFile(buffer);
      break;
    default:
      return res.status(400).json({
        error: 'Unsupported format',
        message: 'Only CSV, JSON, and XML formats are supported'
      });
    }

    if (result.tickets.length > 0) {
      storage.addTickets(result.tickets);
    }

    return res.status(200).json({
      total: result.tickets.length + result.errors.length,
      successful: result.tickets.length,
      failed: result.errors.length,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error importing tickets:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to import tickets'
    });
  }
});

/**
 * GET /tickets - List all tickets with optional filtering
 * Supports filtering by category, priority, status, and date range.
 */
router.get('/', (req, res) => {
  try {
    const { category, priority, status, from, to } = req.query;

    const filters = {};
    if (category) filters.category = category;
    if (priority) filters.priority = priority;
    if (status) filters.status = status;
    if (from) filters.from = from;
    if (to) filters.to = to;

    const tickets = Object.keys(filters).length > 0
      ? storage.getFilteredTickets(filters)
      : storage.getAllTickets();

    return res.status(200).json({
      count: tickets.length,
      tickets: tickets.map(t => t.toJSON ? t.toJSON() : t)
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch tickets'
    });
  }
});

/**
 * GET /tickets/:id - Get a specific ticket by ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const ticket = storage.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found',
        id: id
      });
    }

    return res.status(200).json(ticket.toJSON ? ticket.toJSON() : ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch ticket'
    });
  }
});

/**
 * PUT /tickets/:id - Update a ticket
 * Updates ticket fields and sets updated_at timestamp.
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existingTicket = storage.getTicketById(id);
    if (!existingTicket) {
      return res.status(404).json({
        error: 'Ticket not found',
        id: id
      });
    }

    const updates = req.body;
    const updatedTicket = storage.updateTicket(id, updates);

    return res.status(200).json(updatedTicket.toJSON ? updatedTicket.toJSON() : updatedTicket);
  } catch (error) {
    console.error('Error updating ticket:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update ticket'
    });
  }
});

/**
 * DELETE /tickets/:id - Delete a ticket
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const deleted = storage.deleteTicket(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Ticket not found',
        id: id
      });
    }

    return res.status(200).json({
      message: 'Ticket deleted successfully',
      id: id
    });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete ticket'
    });
  }
});

/**
 * POST /tickets/:id/auto-classify - Auto-classify a ticket
 * Analyzes ticket subject and description to assign category and priority.
 */
router.post('/:id/auto-classify', (req, res) => {
  try {
    const { id } = req.params;

    const ticket = storage.getTicketById(id);
    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found',
        id: id
      });
    }

    const classification = classifyTicket(ticket);

    const updates = {
      category: classification.category,
      priority: classification.priority,
      classification_metadata: {
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        keywords_found: classification.keywords_found
      }
    };

    storage.updateTicket(id, updates);

    return res.status(200).json({
      id: ticket.id,
      category: classification.category,
      priority: classification.priority,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      keywords_found: classification.keywords_found
    });
  } catch (error) {
    console.error('Error classifying ticket:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to classify ticket'
    });
  }
});

module.exports = router;
