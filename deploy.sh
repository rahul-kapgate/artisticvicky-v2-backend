#!/bin/bash

set -e

APP_NAME="artistic-vicky-backend"
IMAGE_NAME="artistic-vicky-backend:v3"
ENV_FILE="/etc/artistic-vicky/backend.env"
HEALTH_URL="http://127.0.0.1:5000/health"

echo "======================================"
echo " Deploying Artistic Vicky Backend"
echo "======================================"

echo "1. Pulling latest v3 code..."
git pull origin v3

echo "2. Building Docker image..."
docker build -t "$IMAGE_NAME" .

echo "3. Removing old container..."
docker rm -f "$APP_NAME" 2>/dev/null || true

echo "4. Starting new container..."
docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:5000:5000 \
  "$IMAGE_NAME"

echo "5. Waiting for backend health check..."

for i in {1..12}; do
  if curl -fsS "$HEALTH_URL" > /dev/null; then
    echo ""
    echo "======================================"
    echo " Deployment successful"
    echo " https://api.artisticvickey.in"
    echo "======================================"

    docker ps --filter "name=$APP_NAME"
    exit 0
  fi

  echo "Waiting for backend... ($i/12)"
  sleep 5
done

echo ""
echo "ERROR: Backend health check failed."
echo "Container logs:"
docker logs --tail 50 "$APP_NAME"

exit 1