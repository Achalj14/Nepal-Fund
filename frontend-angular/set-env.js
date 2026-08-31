const fs = require('fs');
const path = require('path');

// 1. Simple parser for .env / .env.local file if it exists
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        // remove surrounding quotes if any
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

// Check .env and .env.local in project directory
loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

// 2. Extract API URL from environment or .env
const explicitApiUrl = (process.env.API_URL || process.env.BACKEND_URL || '').trim();

// 3. Generate environment.prod.ts
const prodApiPath = path.join(__dirname, 'src/environments/environment.prod.ts');
const prodUrl = explicitApiUrl || 'https://nepal-fund.onrender.com';
const prodConfig = `export const environment = {
  production: true,
  apiUrl: '${prodUrl}'
};
`;
fs.writeFileSync(prodApiPath, prodConfig, 'utf8');

// 4. Generate environment.ts (for local development)
const devApiPath = path.join(__dirname, 'src/environments/environment.ts');
let devConfig;
devConfig = `export const environment = {
  production: false,
  apiUrl: ''
};
`;
console.log(`[set-env] Configured relative API URLs for dev proxy`);
fs.writeFileSync(devApiPath, devConfig, 'utf8');

console.log(`[set-env] Generated environment files successfully!`);
