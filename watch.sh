#!/bin/bash
# Watch for JS changes and rebuild
npx nodemon --watch js --ext js --exec "npx babel js -d dist/js && echo 'Rebuilt at $(date)'"
