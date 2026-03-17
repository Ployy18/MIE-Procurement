/**
 * Detects the environment and provides the correct API base URL.
 * Netlify Dev typically runs on port 8888.
 * Production Netlify runs on .netlify.app domains.
 */
const isNetlify = 
  window.location.port === "8888" || 
  window.location.hostname.includes("netlify.app");

// When running on Netlify (prod or dev), use the functions path
// Otherwise, use /api which Vite proxies to the local server
export const API_BASE = isNetlify 
  ? "/.netlify/functions" 
  : "/api";

console.log(`🌐 [API Config] Host: ${window.location.hostname}, Port: ${window.location.port}, API_BASE: ${API_BASE}`);
