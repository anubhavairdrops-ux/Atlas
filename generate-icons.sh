#!/bin/bash
# Script to generate PNG icons from SVG using ImageMagick
# Usage: bash generate_icons.sh

if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Install with: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
    exit 1
fi

# Generate 192x192 icon
convert -background none -size 192x192 artifacts/study-tracker/public/icons/compass.svg artifacts/study-tracker/public/icons/icon-192x192.png

# Generate 512x512 icon
convert -background none -size 512x512 artifacts/study-tracker/public/icons/compass.svg artifacts/study-tracker/public/icons/icon-512x512.png

# Generate favicon
convert -background none -size 64x64 artifacts/study-tracker/public/icons/compass.svg artifacts/study-tracker/public/favicon.ico
convert artifacts/study-tracker/public/favicon.ico -define icon:auto-resize=192,64,48,32,16 artifacts/study-tracker/public/favicon.ico

echo "Icons generated successfully!"
