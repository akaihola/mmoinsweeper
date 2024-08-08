#!/usr/bin/env bash

# Create pre-commit hook
cat << EOF > .git/hooks/pre-commit
#!/usr/bin/env bash
set -e

echo "Running cargo fmt..."
cargo fmt -- --check

# If there are any differences, format the code and stage the changes
if ! git diff --exit-code; then
    echo "Formatting code..."
    cargo fmt
    git add .
fi
EOF

# Make the pre-commit hook executable
chmod +x .git/hooks/pre-commit

echo "Git hooks have been set up successfully."
