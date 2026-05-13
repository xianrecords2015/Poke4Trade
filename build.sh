#!/bin/bash
# Compile all JSX to regular JS
mkdir -p public/dist/js

# Compile each folder
npx babel public/js/utils -d public/dist/js/utils
npx babel public/js/context -d public/dist/js/context  
npx babel public/js/components -d public/dist/js/components
npx babel public/js/pages -d public/dist/js/pages
cp public/js/App.js public/dist/js/ && npx babel public/dist/js/App.js -o public/dist/js/App.js

echo "Build complete!"
