from sqlalchemy.orm import Session
from models.memory_model import Memory
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

class MemoryService:
    """
    Service class for handling memory-related operations such as saving, retrieving, and deleting memories.
    This class encapsulates the business logic for memory management.
    """

    def __init__(self, db: Session):
        """
        Initialize the MemoryService with a database session.

        Args:
            db (Session): SQLAlchemy database session.
        """
        self.db = db
        logger.debug("MemoryService initialized with database session.")

    def save_memory(self, user_id: str, memory_type: str, content: str, tags: list = None, privacy_level: str = "public", expiry_days: int = 7):
        """
        Save a new memory to the database.

        Args:
            user_id (str): The ID of the user saving the memory.
            memory_type (str): The type of memory (e.g., "development", "personal").
            content (str): The content of the memory (e.g., a code snippet or note).
            tags (list, optional): A list of tags associated with the memory. Defaults to None.
            privacy_level (str, optional): The privacy level of the memory ("public" or "private"). Defaults to "public".
            expiry_days (int, optional): The number of days until the memory expires. Defaults to 7.

        Returns:
            Memory: The saved memory object.

        Raises:
            Exception: If an error occurs while saving the memory.
        """
        try:
            new_memory = Memory(
                user_id=user_id,
                memory_type=memory_type,
                content=content,
                tags=tags if tags else [],
                privacy_level=privacy_level,
                expiry_days=expiry_days,
                created_at=datetime.utcnow()
            )
            self.db.add(new_memory)
            self.db.commit()
            logger.info(f"Memory saved successfully: {new_memory.id}")
            return new_memory
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error saving memory: {e}")
            raise

    def get_memories(self, user_id: str, memory_type: str = None, tags: list = None, privacy_level: str = None, page: int = 1, per_page: int = 10, sort_by: str = "created_at", sort_order: str = "desc"):
        """
        Retrieve memories for a specific user with pagination, filtering, and sorting.

        Args:
            user_id (str): The ID of the user whose memories are being retrieved.
            memory_type (str, optional): Filter memories by type (e.g., "development"). Defaults to None.
            tags (list, optional): Filter memories by tags. Defaults to None.
            privacy_level (str, optional): Filter memories by privacy level ("public" or "private"). Defaults to None.
            page (int, optional): The page number for pagination. Defaults to 1.
            per_page (int, optional): The number of memories per page. Defaults to 10.
            sort_by (str, optional): The field to sort by (e.g., "created_at"). Defaults to "created_at".
            sort_order (str, optional): The sort order ("asc" or "desc"). Defaults to "desc".

        Returns:
            list: A list of Memory objects matching the criteria.

        Raises:
            Exception: If an error occurs while retrieving memories.
        """
        try:
            query = self.db.query(Memory).filter(
                (Memory.user_id == user_id) | (Memory.privacy_level == "public")
            )

            # Filter by memory_type
            if memory_type:
                query = query.filter(Memory.memory_type == memory_type)
                logger.debug(f"Filtering memories by type: {memory_type}")

            # Filter by tags (if tags are provided)
            if tags:
                query = query.filter(Memory.tags.contains(tags))
                logger.debug(f"Filtering memories by tags: {tags}")

            # Filter by privacy_level (if provided)
            if privacy_level:
                query = query.filter(Memory.privacy_level == privacy_level)
                logger.debug(f"Filtering memories by privacy level: {privacy_level}")

            # Sorting
            if sort_by == "created_at":
                if sort_order == "asc":
                    query = query.order_by(Memory.created_at.asc())
                    logger.debug("Sorting memories by created_at in ascending order.")
                else:
                    query = query.order_by(Memory.created_at.desc())
                    logger.debug("Sorting memories by created_at in descending order.")

            # Pagination
            memories = query.offset((page - 1) * per_page).limit(per_page).all()
            logger.info(f"Retrieved {len(memories)} memories for user: {user_id}")
            return memories
        except Exception as e:
            logger.error(f"Error retrieving memories: {e}")
            raise

    def delete_expired_memories(self):
        """
        Delete expired memories from the database.
        Memories are considered expired if their creation date is older than their expiry_days.

        Raises:
            Exception: If an error occurs while deleting expired memories.
        """
        try:
            expired_memories = self.db.query(Memory).filter(
                Memory.created_at < datetime.utcnow() - timedelta(days=Memory.expiry_days)
            ).all()

            for memory in expired_memories:
                self.db.delete(memory)
                logger.debug(f"Deleted expired memory: {memory.id}")

            self.db.commit()
            logger.info(f"Deleted {len(expired_memories)} expired memories.")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting expired memories: {e}")
            raise