from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DonationCreate(BaseModel):
    donor_name: str = Field(..., min_length=2, max_length=255, description="Full Name of the donor")
    phone: str = Field(..., min_length=10, max_length=15, description="WhatsApp / Contact Number")
    email: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    amount: float = Field(..., gt=0, description="Donation amount in INR")
    utr_number: str = Field(..., min_length=4, max_length=100, description="UPI Reference / UTR Number / Transaction ID")
    payment_mode: Optional[str] = Field("UPI", max_length=50)
    payment_screenshot: Optional[str] = Field(None, description="Optional image upload path / data")
    message: Optional[str] = Field(None, max_length=1000, description="Words of support / prayers for Nepal")
    is_anonymous: Optional[bool] = Field(False)

class DonationPublicResponse(BaseModel):
    id: int
    receipt_no: str
    donor_name: str
    city: Optional[str] = None
    amount: float
    message: Optional[str] = None
    created_at: Optional[datetime] = None
    is_verified: bool

    class Config:
        from_attributes = True

class DonationReceiptResponse(BaseModel):
    id: int
    receipt_no: str
    donor_name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = None
    amount: float
    utr_number: str
    payment_mode: str
    message: Optional[str] = None
    is_anonymous: bool
    is_verified: bool
    created_at: datetime
    campaign_title: str
    payee_name: str
    upi_id: str

    class Config:
        from_attributes = True

class CampaignStats(BaseModel):
    total_raised: float
    total_donors: int
    target_amount: Optional[float] = None
    progress_percentage: Optional[float] = None
    currency: str
    campaign_title: str
    payee_name: str
    upi_id: str

class AdminDonationResponse(BaseModel):
    id: int
    receipt_no: str
    donor_name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = None
    amount: float
    utr_number: str
    payment_mode: str
    payment_screenshot: Optional[str] = None
    message: Optional[str] = None
    is_anonymous: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True
