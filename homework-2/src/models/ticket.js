const { v4: uuidv4 } = require('uuid');

/**
 * Ticket model class for customer support tickets.
 * Follows the pattern from Homework-1 Transaction model.
 */
class Ticket {
  /**
   * Creates a new Ticket instance.
   * @param {Object} data - Ticket data
   */
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.customer_id = data.customer_id || '';
    this.customer_email = data.customer_email || '';
    this.customer_name = data.customer_name || '';
    this.subject = data.subject || '';
    this.description = data.description || '';

    this.category = data.category ? String(data.category).toLowerCase() : 'other';
    this.priority = data.priority ? String(data.priority).toLowerCase() : 'medium';
    this.status = data.status ? String(data.status).toLowerCase() : 'new';

    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
    this.resolved_at = data.resolved_at || null;

    this.assigned_to = data.assigned_to || null;
    this.tags = Array.isArray(data.tags) ? data.tags : [];

    this.metadata = {
      source: data.metadata?.source || 'api',
      browser: data.metadata?.browser || '',
      device_type: data.metadata?.device_type || ''
    };

    if (data.classification_metadata) {
      this.classification_metadata = {
        confidence: data.classification_metadata.confidence || 0,
        reasoning: data.classification_metadata.reasoning || '',
        keywords_found: data.classification_metadata.keywords_found || []
      };
    }
  }

  /**
   * Serializes the ticket to JSON format.
   * @returns {Object} JSON representation of the ticket
   */
  toJSON() {
    const json = {
      id: this.id,
      customer_id: this.customer_id,
      customer_email: this.customer_email,
      customer_name: this.customer_name,
      subject: this.subject,
      description: this.description,
      category: this.category,
      priority: this.priority,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
      resolved_at: this.resolved_at,
      assigned_to: this.assigned_to,
      tags: this.tags,
      metadata: this.metadata
    };

    if (this.classification_metadata) {
      json.classification_metadata = this.classification_metadata;
    }

    return json;
  }
}

module.exports = Ticket;
