#!/bin/bash

# Install dependencies
cargo build --release

# Run the server
cargo run --release
