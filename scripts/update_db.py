import sqlite3

def update_database():
    conn = sqlite3.connect('memory_db/personavault.db')
    cursor = conn.cursor()

    # Create new tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_id TEXT NOT NULL,
            expires_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            model_name TEXT NOT NULL,
            model_type TEXT,
            model_description TEXT,
            api_key TEXT,
            api_endpoint TEXT,
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 100,
            top_p REAL DEFAULT 0.9,
            system_prompt TEXT,
            response_format TEXT,
            language TEXT,
            privacy_level TEXT,
            tags TEXT,
            expiry_days INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Insert initial data (optional)
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, password_hash, email)
        VALUES (?, ?, ?)
    ''', ('admin', bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()), 'admin@example.com'))

    cursor.execute('''
        INSERT OR IGNORE INTO ai_settings (user_id, model_name, model_type, model_description, api_key, api_endpoint, temperature, max_tokens, top_p, system_prompt, response_format, language, privacy_level, tags, expiry_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (1, 'tinyllama:1.1b', 'local', 'A small and efficient language model.', None, None, 0.7, 100, 0.9, '', 'text', 'en', 'public', '', 7))

    # Commit changes
    conn.commit()
    conn.close()

if __name__ == '__main__':
    update_database()