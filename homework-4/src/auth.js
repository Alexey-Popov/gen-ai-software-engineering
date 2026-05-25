const ADMIN_TOKEN = 'super-secret-admin-token-do-not-share';

export function checkAdmin(authHeader) {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/, '');
  return token === ADMIN_TOKEN;
}
