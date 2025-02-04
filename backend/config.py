import os

class Config:
    DATABASE_URI = os.getenv("DATABASE_URI", "sqlite:///memory_db/personavault.db")