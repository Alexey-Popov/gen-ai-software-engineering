/**
 * Validation constants and functions for tickets.
 * Follows schema-based validation pattern from Homework-1.
 */

const VALID_CATEGORIES = [
  'account_access',
  'technical_issue',
  'billing_question',
  'feature_request',
  'bug_report',
  'other'
];

const VALID_PRIORITIES = ['urgent', 'high', 'medium', 'low'];

const VALID_STATUSES = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

const VALID_SOURCES = ['web_form', 'email', 'api', 'chat', 'phone', 'mobile_app'];

const VALID_DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];

/**
 * Validates email format.
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates subject length.
 * @param {string} subject - Subject to validate
 * @returns {boolean} True if length is 1-200 chars
 */
const isValidSubject = (subject) => {
  if (!subject || typeof subject !== 'string') return false;
  return subject.length >= 1 && subject.length <= 200;
};

/**
 * Validates description length.
 * @param {string} description - Description to validate
 * @returns {boolean} True if length is 10-2000 chars
 */
const isValidDescription = (description) => {
  if (!description || typeof description !== 'string') return false;
  return description.length >= 10 && description.length <= 2000;
};

/**
 * Validates category enum.
 * @param {string} category - Category to validate
 * @returns {boolean} True if valid category
 */
const isValidCategory = (category) => {
  if (!category) return false;
  return VALID_CATEGORIES.includes(String(category).toLowerCase());
};

/**
 * Validates priority enum.
 * @param {string} priority - Priority to validate
 * @returns {boolean} True if valid priority
 */
const isValidPriority = (priority) => {
  if (!priority) return false;
  return VALID_PRIORITIES.includes(String(priority).toLowerCase());
};

/**
 * Validates status enum.
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid status
 */
const isValidStatus = (status) => {
  if (!status) return false;
  return VALID_STATUSES.includes(String(status).toLowerCase());
};

/**
 * Validates source enum.
 * @param {string} source - Source to validate
 * @returns {boolean} True if valid source
 */
const isValidSource = (source) => {
  if (!source) return true; // Source is optional in metadata
  return VALID_SOURCES.includes(String(source).toLowerCase());
};

/**
 * Validates device_type enum.
 * @param {string} deviceType - Device type to validate
 * @returns {boolean} True if valid device type
 */
const isValidDeviceType = (deviceType) => {
  if (!deviceType) return true; // Device type is optional in metadata
  return VALID_DEVICE_TYPES.includes(String(deviceType).toLowerCase());
};

/**
 * Validates tags array.
 * @param {Array} tags - Tags array to validate
 * @returns {boolean} True if valid tags array
 */
const isValidTags = (tags) => {
  if (!tags) return true; // Tags are optional
  if (!Array.isArray(tags)) return false;
  return tags.every(tag => typeof tag === 'string');
};

/**
 * Validates metadata object.
 * @param {Object} metadata - Metadata object to validate
 * @returns {boolean} True if valid metadata
 */
const isValidMetadata = (metadata) => {
  if (!metadata) return true;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) return false;

  if (metadata.source && !isValidSource(metadata.source)) return false;
  return !(metadata.device_type && !isValidDeviceType(metadata.device_type));
};

/**
 * Schema-based validation pattern for ticket objects.
 * Benefits:
 * - Declarative: Rules are defined separately from validation logic
 * - Maintainable: Adding new fields only requires updating this schema
 * - Consistent: All fields are validated the same way
 * - Self-documenting: Schema serves as documentation for ticket structure
 */
const TICKET_SCHEMA = {
  customer_email: {
    required: true,
    validator: isValidEmail,
    messages: {
      required: 'customer_email is required',
      invalid: 'customer_email must be a valid email address (e.g., user@example.com)'
    }
  },
  customer_name: {
    required: true,
    validator: (value) => value && typeof value === 'string' && value.length > 0,
    messages: {
      required: 'customer_name is required',
      invalid: 'customer_name must be a non-empty string'
    }
  },
  subject: {
    required: true,
    validator: isValidSubject,
    messages: {
      required: 'subject is required',
      invalid: 'subject must be between 1 and 200 characters'
    }
  },
  description: {
    required: true,
    validator: isValidDescription,
    messages: {
      required: 'description is required',
      invalid: 'description must be between 10 and 2000 characters'
    }
  },
  category: {
    required: false,
    validator: isValidCategory,
    messages: {
      required: 'category is required',
      invalid: `category must be one of: ${VALID_CATEGORIES.join(', ')}`
    }
  },
  priority: {
    required: false,
    validator: isValidPriority,
    messages: {
      required: 'priority is required',
      invalid: `priority must be one of: ${VALID_PRIORITIES.join(', ')}`
    }
  },
  status: {
    required: false,
    validator: isValidStatus,
    messages: {
      required: 'status is required',
      invalid: `status must be one of: ${VALID_STATUSES.join(', ')}`
    }
  },
  tags: {
    required: false,
    validator: isValidTags,
    messages: {
      required: 'tags is required',
      invalid: 'tags must be an array of strings'
    }
  },
  metadata: {
    required: false,
    validator: isValidMetadata,
    messages: {
      required: 'metadata is required',
      invalid: 'metadata must be a valid object with source, browser, and device_type fields'
    }
  }
};

/**
 * Validates a ticket object against the defined schema.
 * Checks all required fields, formats, and business rules.
 *
 * @param {Object} ticket - The ticket object to validate
 * @returns {Object} Validation result with shape: { isValid: boolean, errors: Array }
 */
const validateTicket = (ticket) => {
  if (!ticket) {
    return { isValid: false, errors: [{ field: 'ticket', message: 'Ticket data is required' }] };
  }

  const errors = [];

  for (const [field, rules] of Object.entries(TICKET_SCHEMA)) {
    const value = ticket[field];

    if (value === undefined || value === null || value === '') {
      if (rules.required) {
        errors.push({ field, message: rules.messages.required });
      }
      continue;
    }

    if (!rules.validator(value)) {
      const message = typeof rules.messages.invalid === 'function'
        ? rules.messages.invalid(value)
        : rules.messages.invalid;
      errors.push({ field, message });
    }
  }

  return { isValid: errors.length === 0, errors };
};

module.exports = {
  validateTicket,
  isValidEmail,
  isValidSubject,
  isValidDescription,
  isValidCategory,
  isValidPriority,
  isValidStatus,
  isValidSource,
  isValidDeviceType,
  isValidTags,
  isValidMetadata,
  VALID_CATEGORIES,
  VALID_PRIORITIES,
  VALID_STATUSES,
  VALID_SOURCES,
  VALID_DEVICE_TYPES
};
