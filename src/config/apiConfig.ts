/**
 * Detects the environment and provides the correct API base URL.
 * Netlify Dev typically runs on port 8888.
 * Production Netlify runs on .netlify.app domains.
 */
const isNetlify = 
  window.location.port === "8888" || 
  window.location.hostname.includes("netlify.app");

export const API_BASE = isNetlify 
  ? "/.netlify/functions" 
  : "/api";

console.log(`🌐 [API Config] Environment: ${isNetlify ? 'Netlify' : 'Local'}, API_BASE: ${API_BASE}`);
