import os
import io
import csv
from fastapi import FastAPI, Depends, HTTPException, Query, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from app.config import settings
from app.database import engine, Base, get_db
from app.models import Donation
from app.schemas import (
    DonationCreate,
    DonationPublicResponse,
    DonationReceiptResponse,
    CampaignStats,
    AdminDonationResponse,
    OrderCreateRequest,
    OrderResponse,
    PaymentVerifyRequest,
)
import app.crud as crud
import app.payment as payment_gateway

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
        "currency": settings.CURRENCY
    }


@app.get("/api/stats", response_model=CampaignStats)
def get_stats(db: Session = Depends(get_db)):
    """Provides live campaign progress, total amount raised, and donor counts."""
    return crud.get_campaign_stats(db)


@app.post("/api/donations", status_code=201)
def submit_donation(donation: DonationCreate, db: Session = Depends(get_db)):
    """Receives and records donor details with transaction UTR verification."""
    existing = db.query(Donation).filter(Donation.utr_number == donation.utr_number.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="This UPI Reference / UTR Number has already been submitted.")
    try:
        new_donation = crud.create_donation(db, donation, is_verified=False)
        return {
            "success": True,
            "message": "Thank you for your generous contribution! Your receipt has been generated.",
            "receipt_no": new_donation.receipt_no,
            "donation_id": new_donation.id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to record donation: {str(e)}")


@app.post("/api/payment/create-order", response_model=OrderResponse)
def create_payment_order(req: OrderCreateRequest):
    """Creates an official Razorpay order for seamless 1-tap checkout."""
    try:
        order = payment_gateway.create_razorpay_order(
            amount=req.amount,
            currency="INR",
            receipt=f"rcpt_{req.phone[-4:] if len(req.phone) >= 4 else '0000'}",
            notes={"donor_name": req.donor_name, "phone": req.phone}
        )
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": settings.RAZORPAY_KEY_ID,
            "is_mock": order.get("is_mock", False)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to initialize payment gateway: {str(e)}")


@app.post("/api/payment/verify-payment")
def verify_payment_and_record(req: PaymentVerifyRequest, db: Session = Depends(get_db)):
    """
    Cryptographically verifies the Razorpay payment signature.
    Only if confirmed by the gateway, automatically creates the verified donation record.
    """
    is_valid = payment_gateway.verify_razorpay_signature(
        order_id=req.razorpay_order_id,
        payment_id=req.razorpay_payment_id,
        signature=req.razorpay_signature
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment verification signature. No payment recorded.")
    
    # Check if payment_id has already been recorded
    existing = db.query(Donation).filter(Donation.utr_number == req.razorpay_payment_id).first()
    if existing:
        return {
            "success": True,
            "receipt_no": existing.receipt_no,
            "donation_id": existing.id,
            "message": "Payment already verified and recorded."
        }

    # Automatically record verified donation in Supabase
    donation_data = DonationCreate(
        donor_name=req.donor_name,
        phone=req.phone,
        email=req.email,
        city=req.city,
        amount=req.amount,
        utr_number=req.razorpay_payment_id,
        payment_mode=req.payment_mode or "UPI (Razorpay)",
        message=req.message,
        is_anonymous=req.is_anonymous
    )
    new_donation = crud.create_donation(db, donation_data, is_verified=True)
    
    return {
        "success": True,
        "receipt_no": new_donation.receipt_no,
        "donation_id": new_donation.id,
        "message": "Payment verified by bank gateway! Official receipt generated."
    }



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
