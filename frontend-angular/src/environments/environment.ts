const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const environment = {
  production: false,
  apiUrl: isLocalhost ? 'http://127.0.0.1:8000' : 'https://nepal-fund.onrender.com'
};
