#!/usr/bin/env bash
# build_layer.sh
# Builds a Lambda layer containing numpy and scipy (manylinux2014 binaries
# compatible with Amazon Linux 2), uploads the zip to S3 (required — zip
# exceeds the ~50 MB direct-upload limit), publishes the layer, and prints
# the Layer ARN to pass to deploy_lambda.sh.
#
# Usage (from repo root):
#   bash aws/scripts/build_layer.sh <S3_BUCKET>
#
# <S3_BUCKET> is the bucket created by CloudFormation (the BucketName output).
# Requirements: pip >= 22, aws CLI configured for us-east-1
set -euo pipefail

BUCKET=${1:-}
REGION=us-east-1
LAYER_NAME=numpy-scipy-py311
S3_KEY=layers/numpy-scipy-layer.zip

if [ -z "$BUCKET" ]; then
  echo "Error: S3 bucket name is required."
  echo ""
  echo "Usage: bash aws/scripts/build_layer.sh <S3_BUCKET>"
  echo ""
  echo "Get your bucket name from the CloudFormation outputs:"
  echo "  aws cloudformation describe-stacks --stack-name laplacian-glm \\"
  echo "    --query 'Stacks[0].Outputs' --region $REGION"
  exit 1
fi

echo "==> Cleaning up previous build..."
rm -rf layer_pkg numpy-scipy-layer.zip

echo "==> Installing numpy + scipy for Amazon Linux 2 (manylinux2014_x86_64)..."
mkdir -p layer_pkg/python
pip install \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 311 \
  --only-binary=:all: \
  --upgrade \
  --quiet \
  -t layer_pkg/python \
  numpy scipy matplotlib

echo "==> Stripping tests, caches, and unused data to stay under 250 MB limit..."
PY=layer_pkg/python

# numpy 2.x references its own _core/tests at import time — do NOT touch numpy tests.
# Only strip scipy and matplotlib test suites.
find "$PY"/scipy      -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$PY"/matplotlib -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true

# Remove compiled bytecode (safe everywhere)
find "$PY" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$PY" -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete

# Remove package metadata
find "$PY" -type d \( -name "*.dist-info" -o -name "*.egg-info" \) -exec rm -rf {} + 2>/dev/null || true

# Remove matplotlib sample data and all fonts except DejaVuSans (used for axis labels)
rm -rf "$PY"/matplotlib/mpl-data/sample_data
find "$PY"/matplotlib/mpl-data/fonts -type f ! -name "DejaVuSans.ttf" -delete 2>/dev/null || true

STRIPPED=$(du -sh layer_pkg | cut -f1)
echo "    Stripped size: $STRIPPED"

echo "==> Zipping layer..."
cd layer_pkg && zip -r ../numpy-scipy-layer.zip python --quiet && cd ..
SIZE=$(du -sh numpy-scipy-layer.zip | cut -f1)
echo "    numpy-scipy-layer.zip  ($SIZE)"

echo "==> Uploading to s3://$BUCKET/$S3_KEY  (required — zip exceeds direct-upload limit)..."
aws s3 cp numpy-scipy-layer.zip "s3://$BUCKET/$S3_KEY" --region "$REGION"

echo "==> Publishing Lambda layer from S3..."
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name "$LAYER_NAME" \
  --description "numpy + scipy for Python 3.11 (Amazon Linux 2)" \
  --content "S3Bucket=$BUCKET,S3Key=$S3_KEY" \
  --compatible-runtimes python3.11 \
  --region "$REGION" \
  --query 'LayerVersionArn' \
  --output text)

rm -rf layer_pkg numpy-scipy-layer.zip

echo ""
echo "============================================================"
echo "  Layer ARN:"
echo "  $LAYER_ARN"
echo "============================================================"
echo ""
echo "Next step:"
echo "  bash aws/scripts/deploy_lambda.sh \"$LAYER_ARN\""
