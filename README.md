# 🥁 Vidarbha Dhol Tasha Pathak - Nepal Relief Fundraiser Web Application

A full-stack, production-ready donation platform designed for **Vidarbha Dhol Tasha Pathak** to collect funds for the tragic calamity in Nepal. It features real-time dynamic UPI QR code generation, mobile one-tap UPI app payment triggers, official digital donation receipts, public donor wall, admin transaction verification ledger, and CSV export.

---

## 📁 Project Structure

```
d:/WebAPP/
├── backend/                             # Python FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py                   # UPI ID, Payee Name, Target Goal, CORS Settings
│   │   ├── database.py                 # SQLite / PostgreSQL Engine
│   │   ├── models.py                   # Donation database table model
│   │   ├── schemas.py                  # Pydantic validation schemas
│   │   ├── crud.py                     # Database operations & stats aggregation
│   │   └── main.py                     # FastAPI routes, CORS, Admin endpoints
│   ├── uploads/                        # Payment screenshots storage
│   ├── requirements.txt                # FastAPI, Uvicorn, SQLAlchemy, Pydantic
│   ├── .env.example                    # Template environment variables
│   ├── .env                            # Local configuration file
│   └── run.py                          # Local server launcher script
│
├── frontend/                            # Responsive UI & Dynamic QR Client
│   ├── index.html                      # Main Donor Landing Page & Form
│   ├── admin.html                      # Admin Audit Dashboard & CSV Export
│   ├── css/
│   │   └── style.css                   # Glassmorphism & Saffron/Red Relief Styling
│   ├── js/
│   │   ├── config.js                   # Backend API endpoint configuration
│   │   ├── app.js                      # Dynamic QR generation & Form submission logic
│   │   ├── receipt.js                  # Digital Receipt Generator (Print & WhatsApp)
│   │   └── admin.js                    # Admin table, verification toggle, CSV export
│   ├── vercel.json                     # Vercel deployment config
│   └── netlify.toml                    # Netlify deployment config
│
└── README.md                           # Complete Free Hosting & Connection Guide
```

---

## 🚀 Part 1: Running Locally on Your Computer

### 1. Run the Python Backend
Open a terminal in the project root:

```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Start the FastAPI backend server
python backend/run.py
```
> The backend server will start at **`http://127.0.0.1:8000`**.  
> You can view the interactive API Documentation at: **`http://127.0.0.1:8000/docs`**

### 2. Run the Frontend
Simply open `frontend/index.html` in any web browser (Double-click `frontend/index.html` or use VS Code "Live Server" / `npx serve frontend`).

---

## ⚙️ Customizing UPI ID & Campaign Details

Edit `backend/.env` (or set environment variables on your hosting provider):

| Variable | Description | Example |
| :--- | :--- | :--- |
| `UPI_ID` | Your official Bank/Organization UPI ID | `vidarbhadholtashapathak@upi` |
| `PAYEE_NAME` | Name shown inside GPay / PhonePe | `Vidarbha Dhol Tasha Pathak` |
| `CAMPAIGN_TITLE` | Campaign Title | `Nepal Tragedy Relief Fund` |
| `TARGET_AMOUNT` | Fundraising Goal in INR | `500000` |
| `ADMIN_SECRET` | Password to access `/admin.html` | `vidarbha@admin2026` |
| `CORS_ORIGINS` | Allowed frontend domains (`*` for all) | `*` |

---

## 🌐 Part 2: Step-by-Step Free Hosting Guide

You can host both the Backend and Frontend **100% Free** without requiring a credit card.

### Step A: Push Code to GitHub
1. Initialize git and push the project to a GitHub repository (e.g. `https://github.com/your-username/nepal-relief-fund`).

---

### Step B: Host the Python Backend (100% Free on Render.com)

1. Go to [Render.com](https://render.com) and create a free account.
2. Click **"New +"** $\rightarrow$ **"Web Service"**.
3. Connect your GitHub repository.
4. Fill in the service details:
   - **Name**: `vidarbha-nepal-relief-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   - `UPI_ID` = `your_upi_id@upi`
   - `PAYEE_NAME` = `Vidarbha Dhol Tasha Pathak`
   - `ADMIN_SECRET` = `your_strong_admin_password`
   - `CORS_ORIGINS` = `*`
6. Click **"Create Web Service"**.
7. Once deployed, Render will give you a public URL (e.g., `https://vidarbha-nepal-relief-backend.onrender.com`).

---

### Step C: Host the Frontend (100% Free on Vercel or Netlify)

#### Option 1: Vercel (Recommended)
1. Go to [Vercel.com](https://vercel.com) and log in with GitHub.
2. Click **"Add New..."** $\rightarrow$ **"Project"**.
3. Select your repository.
4. In the configuration:
   - **Root Directory**: Click "Edit" and select `frontend`.
   - **Framework Preset**: `Other`.
5. Click **"Deploy"**.
6. Vercel will instantly provide your live URL (e.g., `https://vidarbha-nepal-relief.vercel.app`).

#### Option 2: Netlify (Alternative)
1. Go to [Netlify.com](https://netlify.com).
2. Click **"Add new site"** $\rightarrow$ **"Import an existing project"** $\rightarrow$ select GitHub repo.
3. Set **Base directory**: `frontend` and **Publish directory**: `frontend`.
4. Click **"Deploy site"**.

---

## 🔗 Part 3: Connecting Frontend & Backend

Once your backend is live on Render:

1. Open `frontend/js/config.js`.
2. Update the `BACKEND_API_URL` with your Render backend URL:
   ```javascript
   const CONFIG = {
     BACKEND_API_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
       ? "http://127.0.0.1:8000"
       : "https://vidarbha-nepal-relief-backend.onrender.com", // <-- Your live Render backend URL
     // ...
   };
   ```
3. Commit and push this change to GitHub — Vercel will automatically redeploy the frontend with the live connection!

---

## 📱 Features Walkthrough

### 1. Dynamic Amount UPI QR Code
- Whenever a donor clicks preset pills (₹101, ₹251, ₹501, ₹1,001, ₹2,100, ₹5,001) or types a custom amount, the QR code **instantly re-renders** with the exact amount embedded.
- When scanned using **Google Pay, PhonePe, Paytm, or BHIM**, the amount and beneficiary name are pre-filled automatically!

### 2. One-Tap Mobile Payment
- On mobile devices, donors can click **"⚡ Pay via UPI App"** to launch their installed payment app directly via UPI intent protocol (`upi://pay?...`).

### 3. Instant Digital Receipt & WhatsApp Share
- After submitting their name and 12-digit UTR Transaction ID, a formatted digital receipt with unique receipt number (e.g. `VDTP-NPL-2026-0001`), amount in words, and verification stamp pops up immediately.
- Donors can download/print as PDF or click **"💬 Share on WhatsApp"** to spread awareness.

### 4. Admin Audit Dashboard (`/admin.html`)
- Log in with the `ADMIN_SECRET` key to view the full ledger of all transactions.
- Verify donations against bank records with the 1-click **"Verify"** toggle.
- Export all records as a `.csv` spreadsheet anytime.
