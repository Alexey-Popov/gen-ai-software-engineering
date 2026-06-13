import { Router, Request, Response, NextFunction } from 'express';
import { importTickets, ImportFormat } from '../services/import-service';
import { getTicket, updateTicket } from '../services/ticket-service';
import { classifyTicket, logDecision } from '../services/classifier';

const router = Router();

function detectFormat(content: string, contentType: string, queryFormat: string): ImportFormat {
  if (queryFormat === 'csv' || queryFormat === 'json' || queryFormat === 'xml') {
    return queryFormat as ImportFormat;
  }
  if (contentType.includes('text/csv')) return 'csv';
  if (contentType.includes('application/json')) return 'json';
  if (contentType.includes('application/xml') || contentType.includes('text/xml')) return 'xml';

  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';
  return 'csv';
}

router.post('/import', (req: Request, res: Response, next: NextFunction): void => {
  try {
    let content: string;

    if (typeof req.body === 'string') {
      content = req.body;
    } else if (Array.isArray(req.body) || (req.body && typeof req.body === 'object')) {
      // express.json() already parsed the body — serialize back for importTickets
      content = JSON.stringify(req.body);
    } else {
      res.status(400).json({
        error: 'No file content provided',
        details: [{ field: 'body', message: 'Send raw text content or JSON with a "content" field' }],
        requestId: (req as any).requestId,
      });
      return;
    }

    const format = detectFormat(
      content,
      req.headers['content-type'] || '',
      ((req.query.format as string) || '').toLowerCase()
    );

    const result = importTickets(content, format);

    if (req.query.auto_classify === 'true') {
      for (const id of result.created_ids) {
        try {
          const ticket = getTicket(id);
          if (ticket) {
            const classification = classifyTicket(ticket);
            updateTicket(id, { category: classification.category, priority: classification.priority });
            logDecision(id, ticket, classification);
          }
        } catch (classifyErr) {
          console.error(`[AUTO-CLASSIFY] Failed for ticket ${id}:`, classifyErr);
        }
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
