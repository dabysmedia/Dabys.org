#!/bin/bash
# Load nvm so npm is available, then start Next.js dev server
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd "$(dirname "$0")"
echo "Starting dev server at http://localhost:3000 ..."
exec npm run dev
