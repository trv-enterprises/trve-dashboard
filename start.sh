#!/bin/bash

# Start script for Dynamic Dashboard
# This script starts both the server and client in separate terminal tabs (macOS)

echo "Starting Dynamic Dashboard..."
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Opening server in new terminal tab..."
  osascript -e 'tell application "Terminal" to activate' \
            -e 'tell application "Terminal" to do script "cd \"'$PWD'/server\" && npm start"'

  sleep 2

  echo "Opening client in new terminal tab..."
  osascript -e 'tell application "Terminal" to activate' \
            -e 'tell application "Terminal" to do script "cd \"'$PWD'/client\" && npm run dev"'

  echo ""
  echo "Dashboard starting!"
  echo "Server: http://localhost:3001"
  echo "Client: http://localhost:5173"
else
  echo "This script is designed for macOS."
  echo "Please run the following commands in separate terminals:"
  echo ""
  echo "Terminal 1:"
  echo "  npm run server"
  echo ""
  echo "Terminal 2:"
  echo "  npm run client"
fi
