/**
 * Global Frontend Configuration
 * Update BACKEND_API_URL with your deployed Render/Railway backend URL when hosting online.
 */
const CONFIG = {
  // Local default: http://127.0.0.1:8000
  // When hosted on Render/Railway, change this to: "https://your-backend-service.onrender.com"
  BACKEND_API_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://vidarbha-nepal-relief-backend.onrender.com", // Fallback / placeholder for production

  // Default UPI info if backend is momentarily sleeping / offline
  DEFAULT_UPI_ID: "vidarbhadholtashapathak@upi",
  DEFAULT_PAYEE_NAME: "Vidarbha Dhol Tasha Pathak",
  DEFAULT_CAMPAIGN_TITLE: "Nepal Tragedy Relief Fund - Vidarbha Dhol Tasha Pathak",
  DEFAULT_TARGET_AMOUNT: 500000,
  DEFAULT_CURRENCY: "INR"
};

// Expose globally
window.CONFIG = CONFIG;
