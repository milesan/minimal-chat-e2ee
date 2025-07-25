// Input validation utilities

// Validate username
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  
  const trimmed = username.trim();
  
  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (trimmed.length > 30) {
    return { valid: false, error: 'Username must be less than 30 characters' };
  }
  
  // Allow alphanumeric, spaces, dashes, underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, spaces, dashes, and underscores' };
  }
  
  return { valid: true, value: trimmed };
}

// Validate server/channel name
export function validateName(name, type = 'name') {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${type} is required` };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 1) {
    return { valid: false, error: `${type} cannot be empty` };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: `${type} must be less than 50 characters` };
  }
  
  // Prevent XSS attempts in names
  if (/<[^>]*>/g.test(trimmed)) {
    return { valid: false, error: `${type} cannot contain HTML tags` };
  }
  
  return { valid: true, value: trimmed };
}

// Validate URL
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  
  const trimmed = url.trim();
  
  if (trimmed.length < 1) {
    return { valid: false, error: 'URL cannot be empty' };
  }
  
  if (trimmed.length > 2000) {
    return { valid: false, error: 'URL is too long' };
  }
  
  // Block dangerous protocols
  const dangerousProtocols = /^(javascript:|data:|vbscript:|file:|about:|chrome:)/i;
  if (dangerousProtocols.test(trimmed)) {
    return { valid: false, error: 'Invalid URL protocol' };
  }
  
  // Basic URL validation - accepts relative and absolute URLs
  try {
    // If it starts with http:// or https://, validate as absolute URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      new URL(trimmed);
    } else if (trimmed.startsWith('//')) {
      // Protocol-relative URL
      new URL('https:' + trimmed);
    } else if (trimmed.startsWith('/')) {
      // Relative URL - just check for basic validity
      if (trimmed.includes('<') || trimmed.includes('>')) {
        return { valid: false, error: 'Invalid characters in URL' };
      }
    } else {
      // Could be a bare domain or relative path
      // Try to parse as URL with https prefix
      new URL('https://' + trimmed);
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
  
  return { valid: true, value: trimmed };
}

// Validate message content
export function validateMessage(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content is required' };
  }
  
  const trimmed = content.trim();
  
  if (trimmed.length < 1) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > 5000) {
    return { valid: false, error: 'Message is too long (max 5000 characters)' };
  }
  
  return { valid: true, value: trimmed };
}

// Validate image URL
export function validateImageUrl(url) {
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return urlValidation;
  }
  
  // Check for image extensions
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
  if (!imageExtensions.test(urlValidation.value)) {
    return { valid: false, error: 'URL must point to an image file' };
  }
  
  return { valid: true, value: urlValidation.value };
}

// Validate topic/description
export function validateText(text, fieldName, maxLength = 200) {
  if (!text || typeof text !== 'string') {
    return { valid: true, value: '' }; // Optional fields
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }
  
  // Prevent XSS attempts
  if (/<[^>]*>/g.test(trimmed)) {
    return { valid: false, error: `${fieldName} cannot contain HTML tags` };
  }
  
  return { valid: true, value: trimmed };
}

// Validate base64 image data
export function validateImageData(imageData, filename) {
  if (!imageData || typeof imageData !== 'string') {
    return { valid: false, error: 'Image data is required' };
  }
  
  // Check if it's a valid data URL
  const dataUrlRegex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  if (!dataUrlRegex.test(imageData)) {
    return { valid: false, error: 'Invalid image format. Must be JPEG, PNG, GIF, or WebP' };
  }
  
  // Extract base64 data
  const base64Data = imageData.split(',')[1];
  if (!base64Data) {
    return { valid: false, error: 'Invalid image data' };
  }
  
  // Check size (limit to 5MB)
  const sizeInBytes = (base64Data.length * 3) / 4;
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (sizeInBytes > maxSize) {
    return { valid: false, error: 'Image size must be less than 5MB' };
  }
  
  // Validate filename if provided
  if (filename) {
    const filenameValidation = validateText(filename, 'Filename', 100);
    if (!filenameValidation.valid) {
      return filenameValidation;
    }
    
    // Check for valid image extension
    const validExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (!validExtensions.test(filename)) {
      return { valid: false, error: 'Filename must have a valid image extension' };
    }
  }
  
  return { valid: true, value: imageData, filename: filename ? filename.trim() : null };
}