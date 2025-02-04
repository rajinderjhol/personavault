from fastapi import APIRouter, Depends
from services.memory_service import MemoryService
from models.memory_model import Memory
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter()


@app.route('/memories', methods=['GET'])
@session_required
def get_memories(user_id):
    """Endpoint to fetch memories for the logged-in user."""
    try:
        with get_db_connection() as conn:  # Use context manager for database connection
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM memories WHERE user_id = ?', (user_id,))
            memories = cursor.fetchall()
            return jsonify({"memories": memories})
    except Exception as e:
        logger.error(f"Error in /memories endpoint: {e}")
        return error_response("An error occurred while fetching memories.", 500)


@router.post("/memories")
def save_memory(memory: Memory, db: Session = Depends(get_db)):
    memory_service = MemoryService(db)
    return memory_service.save_memory(
        user_id=memory.user_id,
        memory_type=memory.memory_type,
        content=memory.content,
        tags=memory.tags
    )

@router.get("/memories")
def get_memories(self, user_id: str, memory_type: str = None, tags: list = None, privacy_level: str = None, page: int = 1, per_page: int = 10, sort_by: str = "created_at", sort_order: str = "desc"):
    """
    Retrieve memories for a specific user with pagination, filtering, and sorting.
    Only the owner of the memory or public memories are returned.
    """
    query = self.db.query(Memory).filter(
        (Memory.user_id == user_id) | (Memory.privacy_level == "public")
    )

    # Filter by memory_type
    if memory_type:
        query = query.filter(Memory.memory_type == memory_type)

    # Filter by tags (if tags are provided)
    if tags:
        query = query.filter(Memory.tags.contains(tags))

    # Filter by privacy_level (if provided)
    if privacy_level:
        query = query.filter(Memory.privacy_level == privacy_level)

    # Sorting
    if sort_by == "created_at":
        if sort_order == "asc":
            query = query.order_by(Memory.created_at.asc())
        else:
            query = query.order_by(Memory.created_at.desc())

    # Pagination
    memories = query.offset((page - 1) * per_page).limit(per_page).all()
    return memories
    

#  look for a route definition for api/ai-settings


@router.post("/ai-settings")
def update_ai_settings(settings: dict, db: Session = Depends(get_db)):
    # Logic to update AI settings
    try:
        # Example: Update AI settings in the database
        # Replace this with your actual logic
        memory_service = MemoryService(db)
        memory_service.update_ai_settings(settings)
        return {"status": "success", "message": "AI settings updated"}
    except Exception as e:
        logger.error(f"Error updating AI settings: {e}")
        return {"status": "error", "message": "Failed to update AI settings"}