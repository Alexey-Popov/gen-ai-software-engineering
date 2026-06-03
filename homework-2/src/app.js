const express = require('express');
const multer = require('multer');
const { createTicket, getTickets, getTicketById, updateTicket, deleteTicket } = require('./models/ticket');
const { classifyTicket } = require('./services/classificationService');
const { importTickets } = require('./services/importService');

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/tickets', (req, res) => {
  try {
    const ticket = createTicket(req.body);
    if (req.query.autoClassify === 'true') {
      const classification = classifyTicket(ticket);
      updateTicket(ticket.id, { category: classification.category, priority: classification.priority });
      Object.assign(ticket, { category: classification.category, priority: classification.priority });
    }
    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/tickets/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const ext = req.file.originalname.split('.').pop().toLowerCase();
  
  if (!['json', 'csv', 'xml'].includes(ext)) {
    return res.status(400).json({ error: 'Invalid file format' });
  }

  const result = importTickets(req.file.buffer, ext);
  res.status(200).json(result);
});

app.get('/tickets', (req, res) => {
  const tickets = getTickets(req.query);
  res.json(tickets);
});

app.get('/tickets/:id', (req, res) => {
  const ticket = getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  res.json(ticket);
});

app.put('/tickets/:id', (req, res) => {
  const ticket = updateTicket(req.params.id, req.body);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  res.json(ticket);
});

app.delete('/tickets/:id', (req, res) => {
  const success = deleteTicket(req.params.id);
  if (!success) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

app.post('/tickets/:id/auto-classify', (req, res) => {
  const ticket = getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  
  const classification = classifyTicket(ticket);
  updateTicket(ticket.id, { category: classification.category, priority: classification.priority });
  
  res.json(classification);
});

module.exports = app;
