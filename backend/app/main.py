import os
import io
import csv
from fastapi import FastAPI, Depends, HTTPException, Query, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

import razorpay
from app.config import settings
from app.database import engine, Base, get_db
from app.models import Donation
import app.models as models
from app.schemas import (
    DonationCreate,
    DonationPublicResponse,
    DonationReceiptResponse,
    CampaignStats,
    AdminDonationResponse,
    RazorpayOrderCreate,
    RazorpayPaymentVerify,
)
import app.crud as crud

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for Vidarbha Dhol Tasha Pathak - Nepal Relief Fundraiser"
)

# Setup CORS to allow requests from any frontend domain (Vercel, Netlify, localhost)
origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "campaign": settings.CAMPAIGN_TITLE,
        "payee_name": settings.PAYEE_NAME,
        "upi_id": settings.UPI_ID,
        "docs_url": "/docs"
    }


@app.get("/api/config")
def get_campaign_config():
    """Provides public campaign & UPI payment configuration."""
    return {
        "campaign_title": settings.CAMPAIGN_TITLE,
        "payee_name": settings.PAYEE_NAME,
        "upi_id": settings.UPI_ID,
        "target_amount": settings.TARGET_AMOUNT,
        "currency": settings.CURRENCY,
        "razorpay_key_id": settings.RAZORPAY_KEY_ID
    }


@app.get("/api/stats", response_model=CampaignStats)
def get_stats(db: Session = Depends(get_db)):
    """Provides live campaign progress, total amount raised, and donor counts."""
    return crud.get_campaign_stats(db)


@app.post("/api/donations", status_code=201)
def submit_donation(donation: DonationCreate, db: Session = Depends(get_db)):
    """Receives and records donor details with transaction UTR verification."""
    try:
        existing = db.query(models.Donation).filter(models.Donation.utr_number == donation.utr_number.strip()).first()
        if existing:
            existing.donor_name = donation.donor_name.strip()
            existing.phone = donation.phone.strip()
            if donation.email:
                existing.email = donation.email.strip()
            if donation.city:
                existing.city = donation.city.strip()
            if donation.message:
                existing.message = donation.message.strip()
            db.commit()
            db.refresh(existing)
            new_donation = existing
        else:
            new_donation = crud.create_donation(db, donation)
        return {
            "success": True,
            "message": "Thank you for your generous contribution to the Nepal Relief Fund!",
            "receipt_no": new_donation.receipt_no,
            "donation_id": new_donation.id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to record donation: {str(e)}")


@app.get("/api/donations", response_model=List[DonationPublicResponse])
def list_recent_donations(limit: int = Query(25, ge=1, le=100), db: Session = Depends(get_db)):
    """Public donor wall / transparency ledger."""
    return crud.get_public_donations(db, limit=limit)


@app.get("/api/donations/receipt/{receipt_no_or_id}")
def get_receipt(receipt_no_or_id: str, db: Session = Depends(get_db)):
    """Fetches printable receipt details by ID or Receipt Number."""
    if receipt_no_or_id.isdigit():
        donation = crud.get_donation_by_id(db, int(receipt_no_or_id))
    else:
        donation = crud.get_donation_by_receipt(db, receipt_no_or_id)
        
    if not donation:
        raise HTTPException(status_code=404, detail="Donation record not found")
        
    return {
        "id": donation.id,
        "receipt_no": donation.receipt_no,
        "donor_name": donation.donor_name,
        "phone": donation.phone,
        "email": donation.email,
        "city": donation.city,
        "amount": donation.amount,
        "utr_number": donation.utr_number,
        "payment_mode": donation.payment_mode,
        "message": donation.message,
        "is_anonymous": donation.is_anonymous,
        "is_verified": donation.is_verified,
        "created_at": donation.created_at.strftime("%d %b %Y, %I:%M %p") if donation.created_at else "",
        "campaign_title": settings.CAMPAIGN_TITLE,
        "payee_name": settings.PAYEE_NAME,
        "upi_id": settings.UPI_ID
    }


# ==========================================
# RAZORPAY PAYMENT GATEWAY ENDPOINTS
# ==========================================

@app.post("/api/payment/create-order")
def create_razorpay_order(payload: RazorpayOrderCreate):
    """Creates a Razorpay Order for online payments."""
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Razorpay API keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env"
        )
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order_amount_paise = int(round(payload.amount * 100))
        order_data = {
            "amount": order_amount_paise,
            "currency": "INR",
            "payment_capture": 1
        }
        order = client.order.create(data=order_data)
        return {
            "order_id": order["id"],
            "amount": payload.amount,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create Razorpay order: {str(e)}")


@app.post("/api/payment/verify")
def verify_razorpay_payment(payload: RazorpayPaymentVerify, db: Session = Depends(get_db)):
    """Cryptographically verifies Razorpay signature, records donation, and generates receipt."""
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Razorpay API keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env"
        )

    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    try:
        client.utility.verify_payment_signature({
            'razorpay_order_id': payload.razorpay_order_id,
            'razorpay_payment_id': payload.razorpay_payment_id,
            'razorpay_signature': payload.razorpay_signature
        })
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Razorpay signature. Verification failed.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signature verification error: {str(e)}")

    donation_data = DonationCreate(
        donor_name=payload.donor_name,
        phone=payload.phone,
        email=payload.email,
        city=payload.city,
        amount=payload.amount,
        utr_number=payload.razorpay_payment_id,
        payment_mode="Razorpay",
        message=payload.message,
        is_anonymous=payload.is_anonymous or False
    )

    try:
        existing = db.query(models.Donation).filter(models.Donation.utr_number == payload.razorpay_payment_id.strip()).first()
        if existing:
            if payload.donor_name:
                existing.donor_name = payload.donor_name.strip()
            if payload.phone:
                existing.phone = payload.phone.strip()
            if payload.email:
                existing.email = payload.email.strip()
            if payload.city:
                existing.city = payload.city.strip()
            if payload.message:
                existing.message = payload.message.strip()
            db.commit()
            db.refresh(existing)
            new_donation = existing
        else:
            new_donation = crud.create_donation(db, donation_data)
        return {
            "success": True,
            "message": "Payment verified and contribution recorded successfully!",
            "receipt_no": new_donation.receipt_no,
            "donation_id": new_donation.id,
            "receipt": {
                "id": new_donation.id,
                "receipt_no": new_donation.receipt_no,
                "donor_name": new_donation.donor_name,
                "phone": new_donation.phone,
                "email": new_donation.email,
                "city": new_donation.city,
                "amount": new_donation.amount,
                "utr_number": new_donation.utr_number,
                "payment_mode": new_donation.payment_mode,
                "message": new_donation.message,
                "is_anonymous": new_donation.is_anonymous,
                "is_verified": new_donation.is_verified,
                "created_at": new_donation.created_at.strftime("%d %b %Y, %I:%M %p") if new_donation.created_at else "",
                "campaign_title": settings.CAMPAIGN_TITLE,
                "payee_name": settings.PAYEE_NAME,
                "upi_id": settings.UPI_ID
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record verified donation: {str(e)}")



# ==========================================
# ADMIN ENDPOINTS (Protected with header secret)
# ==========================================

def verify_admin_key(x_admin_secret: Optional[str] = Header(None)):
    if not x_admin_secret or x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid Admin Authorization Key")
    return True


@app.get("/api/admin/donations", response_model=List[AdminDonationResponse])
def admin_list_donations(
    skip: int = 0,
    limit: int = 200,
    is_admin: bool = Depends(verify_admin_key),
    db: Session = Depends(get_db)
):
    """Admin-only ledger with phone numbers, emails, and full audit logs."""
    return crud.get_all_donations_admin(db, skip=skip, limit=limit)


@app.patch("/api/admin/donations/{donation_id}/verify")
def admin_toggle_verify(
    donation_id: int,
    is_admin: bool = Depends(verify_admin_key),
    db: Session = Depends(get_db)
):
    """Admin toggle to verify or flag a payment."""
    donation = crud.toggle_verify_donation(db, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    return {"success": True, "donation_id": donation.id, "is_verified": donation.is_verified}


@app.get("/api/admin/export")
def admin_export_csv(
    x_admin_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Export all donation records as CSV for bank and accounts reconciliation."""
    if not x_admin_secret or x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid Admin Key")

    donations = crud.get_all_donations_admin(db, limit=5000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Receipt No", "Date", "Donor Name", "Phone", "Email", "City", "Amount (INR)", "UTR / Txn ID", "Payment Mode", "Verified", "Message"])
    
    for d in donations:
        writer.writerow([
            d.id,
            d.receipt_no,
            d.created_at.strftime("%Y-%m-%d %H:%M:%S") if d.created_at else "",
            d.donor_name,
            d.phone,
            d.email or "",
            d.city or "",
            d.amount,
            d.utr_number,
            d.payment_mode,
            "Yes" if d.is_verified else "No",
            d.message or ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nepal_relief_donations.csv"}
    )
