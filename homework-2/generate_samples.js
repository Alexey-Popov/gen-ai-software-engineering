const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const generateTicket = (index) => ({
  id: uuidv4(),
  customer_id: `CUST-${1000 + index}`,
  customer_email: `user${index}@example.com`,
  customer_name: `User ${index}`,
  subject: `Issue ${index}`,
  description: `This is a description for issue ${index}. It needs to be at least 10 chars.`,
  category: ['account_access', 'technical_issue', 'billing_question', 'feature_request', 'bug_report', 'other'][index % 6],
  priority: ['urgent', 'high', 'medium', 'low'][index % 4],
  status: ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'][index % 5],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  resolved_at: null,
  assigned_to: `Agent ${index % 3}`
});

const generateInvalidTicket = (index) => ({
  id: uuidv4(),
  customer_email: `invalid`, // invalid email
  subject: ``, // invalid subject length
  description: `too short`, // invalid desc length
  category: `invalid_category`,
  priority: `super_urgent`
});

// JSON (20)
const jsonTickets = Array.from({ length: 20 }, (_, i) => generateTicket(i));
fs.writeFileSync('sample_tickets.json', JSON.stringify(jsonTickets, null, 2));

// CSV (50)
const { stringify } = require('csv-stringify/sync');
const csvTickets = Array.from({ length: 50 }, (_, i) => generateTicket(i));
fs.writeFileSync('sample_tickets.csv', stringify(csvTickets, { header: true }));

// XML (30)
const xmlTickets = Array.from({ length: 30 }, (_, i) => generateTicket(i));
const xmlContent = `<tickets>\n${xmlTickets.map(t => 
  `  <ticket>
    <id>${t.id}</id>
    <customer_id>${t.customer_id}</customer_id>
    <customer_email>${t.customer_email}</customer_email>
    <customer_name>${t.customer_name}</customer_name>
    <subject>${t.subject}</subject>
    <description>${t.description}</description>
    <category>${t.category}</category>
    <priority>${t.priority}</priority>
    <status>${t.status}</status>
    <created_at>${t.created_at}</created_at>
    <updated_at>${t.updated_at}</updated_at>
    <assigned_to>${t.assigned_to}</assigned_to>
  </ticket>`).join('\n')}\n</tickets>`;
fs.writeFileSync('sample_tickets.xml', xmlContent);

// Invalid
fs.writeFileSync('invalid_tickets.json', JSON.stringify(Array.from({ length: 5 }, (_, i) => generateInvalidTicket(i)), null, 2));

console.log("Samples generated.");
