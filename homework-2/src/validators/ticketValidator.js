import { ValidationError } from '../utils/errors.js';

// Enums
const CATEGORIES = ['account_access', 'technical_issue', 'billing_question', 'feature_request', 'bug_report', 'other'];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const STATUSES = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const SOURCES = ['web_form', 'email', 'api', 'chat', 'phone'];
const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];

// Email regex (RFC 5321-ish)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a ticket object
 * Collects ALL errors in an array (no fail-fast)
 * @param {object} ticket - ticket data to validate
 * @returns {array} array of error messages (empty if valid)
 */
export function validateTicket(ticket) {
  const errors = [];

  if (!ticket) {
    return ['Ticket data is required'];
  }

  // customer_email (required)
  if (!ticket.customer_email) {
    errors.push('customer_email is required');
  } else if (!EMAIL_REGEX.test(ticket.customer_email)) {
    errors.push('customer_email must be a valid email address');
  }

  // customer_name (optional but if provided, 1-100 chars)
  if (ticket.customer_name !== undefined && ticket.customer_name !== null) {
    const name = String(ticket.customer_name).trim();
    if (name.length === 0) {
      errors.push('customer_name cannot be empty');
    } else if (name.length > 100) {
      errors.push('customer_name must be 1-100 characters');
    }
  }

  // customer_id (optional but if provided, non-empty string)
  if (ticket.customer_id !== undefined && ticket.customer_id !== null) {
    if (String(ticket.customer_id).trim().length === 0) {
      errors.push('customer_id cannot be empty');
    }
  }

  // subject (required, 1-200)
  if (!ticket.subject) {
    errors.push('subject is required');
  } else {
    const subjectLen = String(ticket.subject).trim().length;
    if (subjectLen < 1 || subjectLen > 200) {
      errors.push('subject must be 1-200 characters');
    }
  }

  // description (required, 10-2000)
  if (!ticket.description) {
    errors.push('description is required');
  } else {
    const descLen = String(ticket.description).trim().length;
    if (descLen < 10 || descLen > 2000) {
      errors.push('description must be 10-2000 characters');
    }
  }

  // category (optional but if provided, must be in enum)
  if (ticket.category !== undefined && ticket.category !== null) {
    if (!CATEGORIES.includes(ticket.category)) {
      errors.push(
        `category must be one of: ${CATEGORIES.join(', ')}`
      );
    }
  }

  // priority (optional but if provided, must be in enum)
  if (ticket.priority !== undefined && ticket.priority !== null) {
    if (!PRIORITIES.includes(ticket.priority)) {
      errors.push(
        `priority must be one of: ${PRIORITIES.join(', ')}`
      );
    }
  }

  // status (optional but if provided, must be in enum)
  if (ticket.status !== undefined && ticket.status !== null) {
    if (!STATUSES.includes(ticket.status)) {
      errors.push(
        `status must be one of: ${STATUSES.join(', ')}`
      );
    }
  }

  // assigned_to (optional string)
  if (ticket.assigned_to !== undefined && ticket.assigned_to !== null) {
    if (String(ticket.assigned_to).trim().length === 0) {
      errors.push('assigned_to cannot be empty');
    }
  }

  // tags (optional array of strings)
  if (ticket.tags !== undefined && ticket.tags !== null) {
    if (!Array.isArray(ticket.tags)) {
      errors.push('tags must be an array');
    } else {
      const invalidTags = ticket.tags.filter((t) => typeof t !== 'string');
      if (invalidTags.length > 0) {
        errors.push('tags must be strings');
      }
    }
  }

  // metadata (optional object)
  if (ticket.metadata !== undefined && ticket.metadata !== null) {
    if (typeof ticket.metadata !== 'object' || Array.isArray(ticket.metadata)) {
      errors.push('metadata must be an object');
    } else {
      // metadata.source (optional, must be in enum if provided)
      if (
        ticket.metadata.source !== undefined &&
        ticket.metadata.source !== null
      ) {
        if (!SOURCES.includes(ticket.metadata.source)) {
          errors.push(
            `metadata.source must be one of: ${SOURCES.join(', ')}`
          );
        }
      }

      // metadata.device_type (optional, must be in enum if provided)
      if (
        ticket.metadata.device_type !== undefined &&
        ticket.metadata.device_type !== null
      ) {
        if (!DEVICE_TYPES.includes(ticket.metadata.device_type)) {
          errors.push(
            `metadata.device_type must be one of: ${DEVICE_TYPES.join(', ')}`
          );
        }
      }

      // metadata.browser (optional string)
      if (
        ticket.metadata.browser !== undefined &&
        ticket.metadata.browser !== null
      ) {
        if (String(ticket.metadata.browser).trim().length === 0) {
          errors.push('metadata.browser cannot be empty');
        }
      }
    }
  }

  return errors;
}

/**
 * Validate and throw if errors found
 * @param {object} ticket - ticket data to validate
 * @throws {ValidationError} if validation fails
 */
export function validateTicketOrThrow(ticket) {
  const errors = validateTicket(ticket);
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}

/**
 * Validate a partial ticket update (only provided fields)
 * @param {object} ticket - partial ticket data to validate
 * @returns {array} array of error messages (empty if valid)
 */
export function validateTicketPartial(ticket) {
  const errors = [];

  if (!ticket || typeof ticket !== 'object') {
    return ['Update data must be an object'];
  }

  // Only validate fields that are provided
  if ('customer_email' in ticket && ticket.customer_email) {
    if (!EMAIL_REGEX.test(ticket.customer_email)) {
      errors.push('customer_email must be a valid email address');
    }
  }

  if ('customer_name' in ticket && ticket.customer_name) {
    const name = String(ticket.customer_name).trim();
    if (name.length === 0) {
      errors.push('customer_name cannot be empty');
    } else if (name.length > 100) {
      errors.push('customer_name must be 1-100 characters');
    }
  }

  if ('customer_id' in ticket && ticket.customer_id) {
    if (String(ticket.customer_id).trim().length === 0) {
      errors.push('customer_id cannot be empty');
    }
  }

  if ('subject' in ticket && ticket.subject) {
    const subjectLen = String(ticket.subject).trim().length;
    if (subjectLen < 1 || subjectLen > 200) {
      errors.push('subject must be 1-200 characters');
    }
  }

  if ('description' in ticket && ticket.description) {
    const descLen = String(ticket.description).trim().length;
    if (descLen < 10 || descLen > 2000) {
      errors.push('description must be 10-2000 characters');
    }
  }

  if ('category' in ticket && ticket.category) {
    if (!CATEGORIES.includes(ticket.category)) {
      errors.push(
        `category must be one of: ${CATEGORIES.join(', ')}`
      );
    }
  }

  if ('priority' in ticket && ticket.priority) {
    if (!PRIORITIES.includes(ticket.priority)) {
      errors.push(
        `priority must be one of: ${PRIORITIES.join(', ')}`
      );
    }
  }

  if ('status' in ticket && ticket.status) {
    if (!STATUSES.includes(ticket.status)) {
      errors.push(
        `status must be one of: ${STATUSES.join(', ')}`
      );
    }
  }

  if ('assigned_to' in ticket && ticket.assigned_to) {
    if (String(ticket.assigned_to).trim().length === 0) {
      errors.push('assigned_to cannot be empty');
    }
  }

  if ('tags' in ticket && ticket.tags) {
    if (!Array.isArray(ticket.tags)) {
      errors.push('tags must be an array');
    } else {
      const invalidTags = ticket.tags.filter((t) => typeof t !== 'string');
      if (invalidTags.length > 0) {
        errors.push('tags must be strings');
      }
    }
  }

  if ('metadata' in ticket && ticket.metadata) {
    if (typeof ticket.metadata !== 'object' || Array.isArray(ticket.metadata)) {
      errors.push('metadata must be an object');
    } else {
      if (ticket.metadata.source !== undefined && ticket.metadata.source) {
        if (!SOURCES.includes(ticket.metadata.source)) {
          errors.push(
            `metadata.source must be one of: ${SOURCES.join(', ')}`
          );
        }
      }

      if (ticket.metadata.device_type !== undefined && ticket.metadata.device_type) {
        if (!DEVICE_TYPES.includes(ticket.metadata.device_type)) {
          errors.push(
            `metadata.device_type must be one of: ${DEVICE_TYPES.join(', ')}`
          );
        }
      }

      if (ticket.metadata.browser !== undefined && ticket.metadata.browser) {
        if (String(ticket.metadata.browser).trim().length === 0) {
          errors.push('metadata.browser cannot be empty');
        }
      }
    }
  }

  return errors;
}

/**
 * Validate partial update and throw if errors found
 * @param {object} ticket - partial ticket data to validate
 * @throws {ValidationError} if validation fails
 */
export function validateTicketPartialOrThrow(ticket) {
  const errors = validateTicketPartial(ticket);
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}
