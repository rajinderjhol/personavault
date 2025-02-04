import pytest
from sqlalchemy.orm import Session
from models.memory_model import Memory
from services.memory_service import MemoryService
from datetime import datetime, timedelta

@pytest.fixture
def db_session():
    # Mock database session for testing
    return Session()

def test_delete_expired_memories(db_session):
    # Create a memory service instance
    memory_service = MemoryService(db=db_session)

    # Add an expired memory to the database
    expired_memory = Memory(
        user_id="test_user",
        memory_type="test",
        content="Expired memory",
        created_at=datetime.now() - timedelta(days=8),
        expiry_days=7
    )
    db_session.add(expired_memory)
    db_session.commit()

    # Call delete_expired_memories
    memory_service.delete_expired_memories()

    # Verify that the expired memory is deleted
    memory = db_session.query(Memory).filter(Memory.id == expired_memory.id).first()
    assert memory is None