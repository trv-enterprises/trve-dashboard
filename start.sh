#!/bin/bash

# Start script for Dynamic Dashboard
# This script starts both the server and client in separate iTerm2 tabs (macOS)

echo "Starting Dynamic Dashboard..."
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Opening server in new iTerm2 tab..."
  osascript <<EOF
    tell application "iTerm2"
      activate

      # Create new window if no windows exist
      if (count of windows) = 0 then
        create window with default profile
      end if

      # Get current window
      tell current window
        # Create new tab for server
        create tab with default profile
        tell current session
          write text "cd \"$PWD/server\" && npm run dev"
        end tell
      end tell
    end tell
EOF

  sleep 2

  echo "Opening client in new iTerm2 tab..."
  osascript <<EOF
    tell application "iTerm2"
      tell current window
        # Create new tab for client
        create tab with default profile
        tell current session
          write text "cd \"$PWD/client\" && npm run dev"
        end tell
      end tell
    end tell
EOF

  echo ""
  echo "Dashboard starting!"
  echo "Server: http://localhost:3001"
  echo "Client: http://localhost:5173"
else
  echo "This script is designed for macOS with iTerm2."
  echo "Please run the following commands in separate terminals:"
  echo ""
  echo "Terminal 1:"
  echo "  npm run server"
  echo ""
  echo "Terminal 2:"
  echo "  npm run client"
fi
