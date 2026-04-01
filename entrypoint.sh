#!/bin/bash
set -e

# Start nginx in the background
nginx -g "daemon off;" &

# Start Flask backend
cd /app/backend
python api.py
