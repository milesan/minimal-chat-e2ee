// Escape HTML entities to prevent XSS attacks
export function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  return text.replace(/[&<>"'/]/g, char => map[char]);
}

// Validate URL to prevent javascript: and data: URLs
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    // Check for common image extensions
    const pathname = parsed.pathname.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext));
    
    return hasValidExtension;
  } catch {
    // If URL parsing fails, it's not a valid URL
    return false;
  }
}

// Sanitize username to prevent injection
export function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return '';
  // Remove any characters that could be used for injection
  // Allow alphanumeric, spaces, dashes, underscores
  return username.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50);
}