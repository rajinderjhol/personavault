import os

# Define the search pattern and replacement
SEARCH_PATTERN = "http://localhost:5001"
REPLACEMENT = "https://localhost:5001"

def replace_in_file(file_path):
    """Search and replace the pattern in the given file."""
    try:
        with open(file_path, 'r') as file:
            content = file.read()

        if SEARCH_PATTERN in content:
            updated_content = content.replace(SEARCH_PATTERN, REPLACEMENT)
            with open(file_path, 'w') as file:
                file.write(updated_content)
            print("Updated: {}".format(file_path))
    except Exception as e:
        print("Error processing {}: {}".format(file_path, e))

def process_directory(directory):
    """Recursively process all files in the directory."""
    for root, _, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            # Process only text-based files
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.txt')):
                replace_in_file(file_path)

if __name__ == "__main__":
    # Get the current working directory
    frontend_folder = os.path.abspath(os.getcwd())
    print("Processing folder: {}".format(frontend_folder))
    process_directory(frontend_folder)
