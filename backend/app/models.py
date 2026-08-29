import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from app.database import Base

class Donation(Base):
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    receipt_no = Column(String(64), unique=True, index=True)
    donor_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    amount = Column(Float, nullable=False)
    utr_number = Column(String(100), nullable=False, index=True)
    payment_mode = Column(String(50), default="UPI")
    payment_screenshot = Column(Text, nullable=True)  # File path or base64 thumbnail
    message = Column(Text, nullable=True)             # Message of prayer / solidarity
    is_anonymous = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=True)       # Admin status
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_public_dict(self):
        """Returns safe public dictionary omitting private contact details for wall of donors."""
        return {
            "id": self.id,
            "receipt_no": self.receipt_no,
            "donor_name": "Kind Donor (Anonymous)" if self.is_anonymous else self.donor_name,
            "city": self.city if not self.is_anonymous else "India",
            "amount": self.amount,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_verified": self.is_verified
        }
