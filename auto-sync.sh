#!/bin/bash
while true; do
  if [[ -n $(git status -s) ]]; then
    git add .
    git commit -m "Auto-sync $(date '+%Y-%m-%d %H:%M')"
    git push origin main
    echo "Synced at $(date)"
  else
    echo "No changes"
  fi
  sleep 300
done
