#!/bin/bash

# MikroORM CLI Wrapper Script
# Usage: ./scripts/mikro-orm-cli.sh <app> <env> <mikro-orm-command>
# Example: ./scripts/mikro-orm-cli.sh auth local migration:create

APP=$1
ENV=${2:-local}
shift 2
COMMAND=$@

if [ -z "$APP" ]; then
  echo "Error: Missing app name"
  echo "Usage: ./scripts/mikro-orm-cli.sh <app> <env> <mikro-orm-command>"
  echo "Example: ./scripts/mikro-orm-cli.sh auth local migration:create"
  exit 1
fi

# Valid app names
VALID_APPS=("auth" "notification" "sayho-bot")
if [[ ! " ${VALID_APPS[@]} " =~ " ${APP} " ]]; then
  echo "Error: Invalid app name: $APP"
  echo "Valid options: ${VALID_APPS[@]}"
  exit 1
fi

echo "Running MikroORM for app: $APP (env: $ENV)"
echo "Command: $COMMAND"
echo ""

# Execute mikro-orm with config arguments
npx mikro-orm $COMMAND --config.app=$APP --config.env=$ENV
