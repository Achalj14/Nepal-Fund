import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "Vidarbha Dhol Tasha Pathak - Nepal Relief Fund API"
    APP_VERSION: str = "1.0.0"
    
    # Campaign & UPI Configuration
    UPI_ID: str = os.getenv("UPI_ID", "vidarbhadholtashapathak@upi")
    PAYEE_NAME: str = os.getenv("PAYEE_NAME", "Vidarbha Dhol Tasha Pathak")
    CAMPAIGN_TITLE: str = os.getenv("CAMPAIGN_TITLE", "Nepal Tragedy Relief Fund")
    TARGET_AMOUNT: float = float(os.getenv("TARGET_AMOUNT", "500000"))
    CURRENCY: str = "INR"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./donations.db")
    
    # Security / Admin Access
    ADMIN_SECRET: str = os.getenv("ADMIN_SECRET", "vidarbha@admin2026")
    
    # CORS (Allows frontend to talk to backend across different domains/ports)
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    @property
    def cors_origin_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
