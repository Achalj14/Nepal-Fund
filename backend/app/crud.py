import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Donation
from app.schemas import DonationCreate
from app.config import settings

def generate_receipt_number(db: Session) -> str:
    """Generates a sequential human-readable receipt number: VDTP-NPL-YYYY-0001"""
    year = datetime.datetime.now().year
    count = db.query(func.count(Donation.id)).scalar() or 0
    next_id = count + 1
    return f"VDTP-NPL-{year}-{next_id:04d}"

def create_donation(db: Session, donation_in: DonationCreate) -> Donation:
    receipt_no = generate_receipt_number(db)
    
    db_donation = Donation(
        receipt_no=receipt_no,
        donor_name=donation_in.donor_name.strip(),
        phone=donation_in.phone.strip(),
        email=donation_in.email.strip() if donation_in.email else None,
        city=donation_in.city.strip() if donation_in.city else None,
        amount=donation_in.amount,
        utr_number=donation_in.utr_number.strip(),
        payment_mode=donation_in.payment_mode or "UPI",
        payment_screenshot=donation_in.payment_screenshot,
        message=donation_in.message.strip() if donation_in.message else None,
        is_anonymous=donation_in.is_anonymous or False,
        is_verified=True # Auto-verify or leave for admin
    )
    db.add(db_donation)
    db.commit()
    db.refresh(db_donation)
    return db_donation

def get_donation_by_id(db: Session, donation_id: int) -> Donation | None:
    return db.query(Donation).filter(Donation.id == donation_id).first()

def get_donation_by_receipt(db: Session, receipt_no: str) -> Donation | None:
    return db.query(Donation).filter(Donation.receipt_no == receipt_no).first()

def get_public_donations(db: Session, limit: int = 50):
    donations = db.query(Donation).order_by(Donation.created_at.desc()).limit(limit).all()
    return [d.to_public_dict() for d in donations]

def get_all_donations_admin(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Donation).order_by(Donation.created_at.desc()).offset(skip).limit(limit).all()

def toggle_verify_donation(db: Session, donation_id: int) -> Donation | None:
    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if donation:
        donation.is_verified = not donation.is_verified
        db.commit()
        db.refresh(donation)
    return donation

def get_campaign_stats(db: Session):
    total_raised = db.query(func.sum(Donation.amount)).filter(Donation.is_verified == True).scalar() or 0.0
    total_donors = db.query(func.count(Donation.id)).filter(Donation.is_verified == True).scalar() or 0
    target_amount = settings.TARGET_AMOUNT
    progress_percentage = min(round((total_raised / target_amount) * 100, 2), 100.0) if target_amount > 0 else 0.0
    
    return {
        "total_raised": float(total_raised),
        "total_donors": int(total_donors),
        "target_amount": float(target_amount),
        "progress_percentage": float(progress_percentage),
        "currency": settings.CURRENCY,
        "campaign_title": settings.CAMPAIGN_TITLE,
        "payee_name": settings.PAYEE_NAME,
        "upi_id": settings.UPI_ID
    }
