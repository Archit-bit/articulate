#!/usr/bin/env bash
# Deploy Articulate to Google Cloud Run, paid from your Google Cloud credits.
# Run it in Google Cloud Shell (shell.cloud.google.com) from inside this folder:
#   bash deploy-gcp.sh
set -euo pipefail

PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  echo "No project selected. Run:  gcloud config set project YOUR_PROJECT_ID   then run this script again."
  exit 1
fi
REGION="${REGION:-asia-south1}"   # Mumbai
SERVICE="${SERVICE:-articulate}"

if [ -z "${APP_PASSCODE:-}" ]; then
  read -rp "Choose a team passcode (you and your cofounder type this once in the app): " APP_PASSCODE
fi
if [ ${#APP_PASSCODE} -lt 6 ]; then echo "Use at least 6 characters."; exit 1; fi

echo "→ Project: $PROJECT   Region: $REGION"
echo "→ Enabling APIs (Cloud Run, Cloud Build, Artifact Registry, Vertex AI)…"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com

NUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="${NUM}-compute@developer.gserviceaccount.com"
echo "→ Letting the service account build the app and call Vertex AI…"
for ROLE in roles/run.builder roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$ROLE" --condition=None >/dev/null
done

echo "→ Building and deploying (takes 3–5 minutes)…"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --timeout 3600 \
  --memory 512Mi \
  --max-instances 2 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT,APP_PASSCODE=$APP_PASSCODE"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo
echo "✓ Done. Open: $URL"
echo "  In the app: Settings → Engine shows 'Google Cloud server'. Enter the passcode there once."
