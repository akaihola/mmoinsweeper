import os
import re
import zipfile
from datetime import datetime


def update_version(file_path, new_version):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # Pattern to match internal URLs in href and src attributes
    pattern = r'(href|src)="(?!http[s]?://|//|#)([^"]+)(\?v=[^"]*)?"'

    def replace_version(match):
        attr, path, _ = match.groups()
        return f'{attr}="{path}?v={new_version}"'

    updated_content = re.sub(pattern, replace_version, content)

    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(updated_content)


def process_directory(directory, new_version):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(('.html', '.css', '.mjs')):
                file_path = os.path.join(root, file)
                print(f"Processing: {file_path}")
                update_version(file_path, new_version)


def create_zip_archive(source_dir, output_filename):
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)


# Generate new version
new_version = datetime.now().strftime("%Y%m%d%H%M%S")

# Specify the root directory to start from
root_directory = 'public'
process_directory(root_directory, new_version)

print("Version update complete.")

# Create static content archive
archive_name = '../mmoinsweeper-static-content.zip'
create_zip_archive(root_directory, archive_name)

print(f"Static content archive created: {archive_name}")
