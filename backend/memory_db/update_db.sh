#!/bin/bash

# Path to the SQLite database
DATABASE="memory_db/personavault.db"

# SQL command to create the messages table
SQL_COMMAND=$(cat <<EOF
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
EOF
)

# Check if the database file exists
if [ ! -f "$DATABASE" ]; then
    echo "Database file not found: $DATABASE"
    exit 1
fi

# Execute the SQL command
echo "Updating database: $DATABASE"
sqlite3 "$DATABASE" "$SQL_COMMAND"

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo "Database updated successfully."
else
    echo "Failed to update the database."
    exit 1
fi