from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class UserMeOut(BaseModel):
    id: str
    email: Optional[str] = None
    created_at: Optional[datetime] = None
    archetype: Optional[str] = None
    trial_start_date: Optional[datetime] = None
    subscription_status: Optional[str] = None
    motivation_preference: Optional[str] = None

class UserMeUpdate(BaseModel):
    push_token: Optional[str] = None
    timezone: Optional[str] = None
    last_opened_at: Optional[str] = None
    motivation_preference: Optional[str] = None
