from sqlalchemy import Column, Integer, String, JSON, DateTime, Float
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class FeedbackRecord(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    texte_brut = Column(String, nullable=False)
    # The JSON string containing the corrected fields (e.g., {"fournisseur": "Company X", "total_ttc": "1500.00"})
    annotations = Column(JSON, nullable=False)
    # Optional metadata (language, invoice ID, etc.)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
