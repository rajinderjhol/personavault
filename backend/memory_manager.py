import sqlite3
import uuid

def save_memory(user_id, memory_type, content, tags):
    try:
        memory_id = str(uuid.uuid4())
        conn = sqlite3.connect("memory_db/personavault.db")
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO memories (id, user_id, memory_type, content, tags)
            VALUES (?, ?, ?, ?, ?)
        ''', (memory_id, user_id, memory_type, content, tags))
        conn.commit()
        conn.close()
        return memory_id
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

def get_memories(user_id):
    try:
        conn = sqlite3.connect("memory_db/personavault.db")
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM memories WHERE user_id = ?', (user_id,))
        memories = cursor.fetchall()
        conn.close()
        return memories
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
