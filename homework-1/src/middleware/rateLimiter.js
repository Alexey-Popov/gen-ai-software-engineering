const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

const clients = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, client] of clients) {
    if (now > client.resetAt) clients.delete(ip);
  }
}, WINDOW_MS).unref();

export default function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();

  let client = clients.get(ip);
  if (!client || now > client.resetAt) {
    client = { count: 0, resetAt: now + WINDOW_MS };
    clients.set(ip, client);
  }

  client.count++;

  res.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - client.count)));
  res.set('X-RateLimit-Reset', new Date(client.resetAt).toISOString());

  if (client.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((client.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute.`,
      retryAfter,
    });
  }

  next();
}
