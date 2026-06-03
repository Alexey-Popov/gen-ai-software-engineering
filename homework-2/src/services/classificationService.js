function classifyTicket(ticket) {
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
  
  let category = 'other';
  let priority = 'medium';
  let confidence = 0.5;
  const keywords = [];

  // Categorization
  if (/(login|password|2fa|access)/i.test(text)) {
    category = 'account_access'; confidence += 0.3; keywords.push(...text.match(/(login|password|2fa|access)/gi));
  } else if (/(bug|error|crash)/i.test(text)) {
    category = 'bug_report'; confidence += 0.3; keywords.push(...text.match(/(bug|error|crash)/gi));
  } else if (/(payment|invoice|refund|billing)/i.test(text)) {
    category = 'billing_question'; confidence += 0.3; keywords.push(...text.match(/(payment|invoice|refund|billing)/gi));
  } else if (/(enhancement|suggestion|feature)/i.test(text)) {
    category = 'feature_request'; confidence += 0.3; keywords.push(...text.match(/(enhancement|suggestion|feature)/gi));
  }

  // Prioritization
  if (/(can't access|critical|production down|security)/i.test(text)) {
    priority = 'urgent'; keywords.push(...text.match(/(can't access|critical|production down|security)/gi));
  } else if (/(important|blocking|asap)/i.test(text)) {
    priority = 'high'; keywords.push(...text.match(/(important|blocking|asap)/gi));
  } else if (/(minor|cosmetic|suggestion)/i.test(text)) {
    priority = 'low'; keywords.push(...text.match(/(minor|cosmetic|suggestion)/gi));
  }

  confidence = Math.min(1.0, confidence);

  return { category, priority, confidence, reasoning: "Regex rule matching based on keywords", keywords: [...new Set(keywords.map(k => k.toLowerCase()))] };
}

module.exports = { classifyTicket };
