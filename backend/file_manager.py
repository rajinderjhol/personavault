import os
import uuid

def save_file(file):
    try:
        file_id = str(uuid.uuid4())
        file_path = os.path.join("uploads", file_id + "_" + file.filename)
        os.makedirs("uploads", exist_ok=True)
        file.save(file_path)
        return file_id
    except Exception as e:
        print(f"Error saving file: {e}")
        raise
