#!/bin/bash
# Download free notification sounds from various sources
# Run this script to get default notification sounds

SOUNDS_DIR="c:/iDesk/apps/frontend/public/sounds/default"

# Using free sounds from Mixkit and similar sources
# These are CC0/royalty-free notification sounds

echo "Downloading notification sounds..."

# Note: These are placeholder curl commands - replace with actual free sound URLs
# You can get free sounds from:
# - https://mixkit.co/free-sound-effects/notification/
# - https://freesound.org/
# - https://pixabay.com/sound-effects/

# For now, create empty placeholder files
touch "$SOUNDS_DIR/new-ticket.mp3"
touch "$SOUNDS_DIR/assigned.mp3"  
touch "$SOUNDS_DIR/resolved.mp3"
touch "$SOUNDS_DIR/critical-alert.mp3"
touch "$SOUNDS_DIR/message.mp3"
touch "$SOUNDS_DIR/sla-warning.mp3"
touch "$SOUNDS_DIR/sla-breach.mp3"

echo "Sound files created (placeholders). Replace with actual MP3 files from:"
echo "  - https://mixkit.co/free-sound-effects/notification/"
echo "  - https://freesound.org/"
echo "  - https://pixabay.com/sound-effects/"
