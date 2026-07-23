#!/usr/bin/env bash
# Build and push the Lambda container image, then deploy via CloudFormation.
#
# First run:  bash aws/scripts/deploy_container.sh
# Subsequent: same command — rebuilds image, pushes, and CF detects no infra change.
#
# Prerequisites: Docker, AWS CLI, credentials with ECR + CloudFormation + Lambda access.
set -euo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_DEFAULT_REGION:-us-east-1}
REPO_NAME="laplacian-glm"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:latest"

echo "==> Creating ECR repository (if needed)..."
aws ecr describe-repositories \
    --repository-names "${REPO_NAME}" \
    --region "${REGION}" >/dev/null 2>&1 || \
aws ecr create-repository \
    --repository-name "${REPO_NAME}" \
    --region "${REGION}" >/dev/null

echo "==> Logging in to ECR..."
aws ecr get-login-password --region "${REGION}" | \
    docker login --username AWS --password-stdin \
    "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "==> Building and pushing image (linux/amd64)..."
docker buildx build \
    --platform linux/amd64 \
    --provenance=false \
    --push \
    -t "${IMAGE_URI}" \
    aws/lambda/

echo "==> Updating Lambda function code..."
if aws lambda get-function --function-name laplacian-glm --region "${REGION}" >/dev/null 2>&1; then
    aws lambda update-function-code \
        --function-name laplacian-glm \
        --image-uri "${IMAGE_URI}" \
        --region "${REGION}"
    aws lambda wait function-updated --function-name laplacian-glm --region "${REGION}"
    # Multi-dataset compute + rendering needs more memory and a longer timeout
    # (the async job renders ~5 contrasts x 4 hemispheric panels).
    aws lambda update-function-configuration \
        --function-name laplacian-glm \
        --memory-size 4096 \
        --timeout 300 \
        --region "${REGION}"
else
    # First-time create — wire up env, memory, and API Gateway permission
    API_ID=$(aws cloudformation describe-stacks \
        --stack-name laplacian-glm --region "${REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
        --output text | sed 's|https://||' | cut -d'.' -f1)

    aws lambda create-function \
        --function-name laplacian-glm \
        --package-type Image \
        --code ImageUri="${IMAGE_URI}" \
        --role "arn:aws:iam::${ACCOUNT_ID}:role/LaplacianGLMLambdaRole" \
        --memory-size 2048 \
        --timeout 120 \
        --ephemeral-storage Size=2048 \
        --environment "Variables={BUCKET_NAME=laplacian-glm-data,MPLCONFIGDIR=/tmp/matplotlib,NILEARN_DATA=/tmp/nilearn_data}" \
        --region "${REGION}"

    aws lambda wait function-active --function-name laplacian-glm --region "${REGION}"

    aws lambda add-permission \
        --function-name laplacian-glm \
        --statement-id APIGatewayInvoke \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
        --region "${REGION}"
fi

aws lambda wait function-updated --function-name laplacian-glm --region "${REGION}"

echo ""
echo "============================================================"
echo "  Lambda deployed: laplacian-glm"
echo "  Image: ${IMAGE_URI}"
echo "============================================================"
echo ""
echo "Next step — upload precomputed data to S3 (if not already done):"
echo "  python aws/scripts/prep_data.py --bucket laplacian-glm-data --region ${REGION}"
