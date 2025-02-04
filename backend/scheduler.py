from apscheduler.schedulers.background import BackgroundScheduler
from services.memory_service import MemoryService
from models.memory_model import Memory
from sqlalchemy.orm import Session

# Initialize scheduler
scheduler = BackgroundScheduler()

def start_scheduler(db: Session):
    """
    Start the scheduler and add jobs.
    """
    memory_service = MemoryService(db=db)

    # Add job to delete expired memories daily
    scheduler.add_job(memory_service.delete_expired_memories, 'interval', days=1)

    # Start the scheduler
    scheduler.start()