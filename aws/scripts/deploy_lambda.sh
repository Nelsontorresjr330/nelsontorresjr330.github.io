#!/usr/bin/env bash
# deploy_lambda.sh
# Packages aws/lambda/handler.py, deploys it to the Lambda function created
# by CloudFormation, and attaches the numpy+scipy layer built by build_layer.sh.
#
# Usage (from repo root):
#   bash aws/scripts/deploy_lambda.sh <LAYER_ARN>
#
# Run build_layer.sh first to get the LAYER_ARN.
set -euo pipefail

LAYER_ARN=${1:-}
FUNCTION_NAME=laplacian-glm
REGION=us-east-1

if [ -z "$LAYER_ARN" ]; then
  echo "Error: LAYER_ARN is required."
  echo ""
  echo "Usage: bash aws/scripts/deploy_lambda.sh <LAYER_ARN>"
  echo "Run aws/scripts/build_layer.sh first to get the ARN."
  exit 1
fi

echo "==> Packaging aws/lambda/handler.py..."
cd aws/lambda
zip -r ../../function.zip handler.py --quiet
cd ../..
SIZE=$(du -sh function.zip | cut -f1)
echo "    function.zip  ($SIZE)"

echo "==> Updating Lambda function code..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "$REGION" \
  --output text --query 'FunctionName'

echo "==> Waiting for code update to complete..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

echo "==> Attaching layer..."
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --layers "$LAYER_ARN" \
  --region "$REGION" \
  --output text --query 'FunctionName'

echo "==> Waiting for configuration update to complete..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

rm function.zip

echo ""
echo "============================================================"
echo "  Lambda deployed: $FUNCTION_NAME"
echo "============================================================"
echo ""
echo "Next step — upload precomputed data to S3:"
echo ""
echo "  python aws/scripts/prep_data.py --bucket <BUCKET_NAME>"
echo ""
echo "Get your bucket name from the CloudFormation outputs:"
echo "  aws cloudformation describe-stacks --stack-name laplacian-glm \\"
echo "    --query 'Stacks[0].Outputs' --region $REGION"
echo ""
echo "Then paste the ApiEndpoint output value into .env:"
echo "  REACT_APP_GLM_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/run"
