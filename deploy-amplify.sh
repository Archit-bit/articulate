#!/usr/bin/env bash
# Push the latest articulate-site.zip to your existing AWS Amplify app (manual "Deploy without Git" app).
# Usage (Terminal, from anywhere):  bash ~/Desktop/Personal/VIBECODE/articulate/deploy-amplify.sh
# Optional: APP_NAME=articulate BRANCH=main bash deploy-amplify.sh
set -euo pipefail
export AWS_PAGER=""
cd "$(dirname "$0")"
ZIP="articulate-site.zip"
APP_NAME="${APP_NAME:-articulate}"
BRANCH="${BRANCH:-main}"
[ -f "$ZIP" ] || { echo "Missing $ZIP — run: npm run package"; exit 1; }

REGION=""; APP_ID=""
for R in ${AWS_REGION:-} $(aws configure get region 2>/dev/null || true) ap-south-1 us-east-1 us-east-2 us-west-2 eu-west-1 eu-central-1 ap-southeast-1 ap-northeast-1; do
  ID=$(aws amplify list-apps --region "$R" --query "apps[?name=='$APP_NAME'].appId | [0]" --output text 2>/dev/null || true)
  if [ -n "$ID" ] && [ "$ID" != "None" ]; then REGION="$R"; APP_ID="$ID"; break; fi
done
if [ -z "$APP_ID" ]; then
  echo "Couldn't find an Amplify app named '$APP_NAME'. Apps in $(aws configure get region):"
  aws amplify list-apps --query 'apps[].[name,appId]' --output text || true
  echo "Re-run with: APP_NAME=<name> bash deploy-amplify.sh"
  exit 1
fi
BRANCHES=$(aws amplify list-branches --region "$REGION" --app-id "$APP_ID" --query 'branches[].branchName' --output text)
if ! echo " $BRANCHES " | grep -q " $BRANCH "; then
  BRANCH=$(echo "$BRANCHES" | awk '{print $1}')
fi
echo "→ App: $APP_NAME ($APP_ID)  Region: $REGION  Branch: $BRANCH"

OUT=$(aws amplify create-deployment --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" --query '[jobId, zipUploadUrl]' --output text)
JOB_ID=$(echo "$OUT" | awk '{print $1}')
URL=$(echo "$OUT" | awk '{print $2}')
echo "→ Uploading $ZIP (job $JOB_ID)…"
curl -sS --fail -X PUT -H "Content-Type: application/zip" --upload-file "$ZIP" "$URL"
aws amplify start-deployment --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" >/dev/null

echo "→ Deploying…"
for i in $(seq 1 60); do
  S=$(aws amplify get-job --region "$REGION" --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --query 'job.summary.status' --output text)
  echo "   status: $S"
  [ "$S" = "SUCCEED" ] && break
  if [ "$S" = "FAILED" ] || [ "$S" = "CANCELLED" ]; then echo "Deployment $S"; exit 1; fi
  sleep 5
done
DOMAIN=$(aws amplify get-app --region "$REGION" --app-id "$APP_ID" --query 'app.defaultDomain' --output text)
echo
echo "✓ LIVE: https://$BRANCH.$DOMAIN   (hard-refresh the page: Cmd+Shift+R)"
