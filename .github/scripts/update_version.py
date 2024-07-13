import os
import re
from datetime import datetime

def update_version(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    new_version = datetime.now().strftime("%Y%m%d%H%M%S")
    
    # Pattern to match internal URLs in href and src attributes
    pattern = r'(href|src)="(?!http[s]?://|//|#)([^"]+)(\?v=[^"]*)?"'
    
    def replace_version(match):
        attr, path, _ = match.groups()
        return f'{attr}="{path}?v={new_version}"'

    updated_content = re.sub(pattern, replace_version, content)

    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(updated_content)

def process_directory(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(('.html', '.css', '.mjs')):
                file_path = os.path.join(root, file)
                print(f"Processing: {file_path}")
                update_version(file_path)

# Specify the root directory to start from
root_directory = 'public'
process_directory(root_directory)

print("Version update complete.")
