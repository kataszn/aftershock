#!/usr/bin/env bash
set -e

# Configuration
AWS_REGION="eu-west-2"
AWS_ACCOUNT_ID="690039670036"
CLUSTER_NAME="aftershock-cluster"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Prevent Git Bash path conversion issues
export MSYS_NO_PATHCONV=1

echo "==> 1. Authenticating Podman with Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | podman login --username AWS --password-stdin $ECR_REGISTRY

echo "==> 2. Building and Pushing API image..."
podman build --format docker -t aftershock-api -f apps/api/Dockerfile .
podman tag aftershock-api:latest $ECR_REGISTRY/aftershock-api:latest
podman push $ECR_REGISTRY/aftershock-api:latest

echo "==> 3. Building and Pushing Worker image..."
podman build --format docker -t aftershock-worker -f apps/worker/Dockerfile .
podman tag aftershock-worker:latest $ECR_REGISTRY/aftershock-worker:latest
podman push $ECR_REGISTRY/aftershock-worker:latest

echo "==> 4. Registering latest Task Definitions..."
if [ -f "api-task-def.json" ]; then
  aws ecs register-task-definition --cli-input-json file://api-task-def.json --region $AWS_REGION
fi

if [ -f "worker-task-def.json" ]; then
  aws ecs register-task-definition --cli-input-json file://worker-task-def.json --region $AWS_REGION
fi

echo "==> 5. Triggering ECS Service Redeployments..."
aws ecs update-service --cluster $CLUSTER_NAME --service aftershock-api-service --force-new-deployment --region $AWS_REGION
aws ecs update-service --cluster $CLUSTER_NAME --service aftershock-worker-service --force-new-deployment --region $AWS_REGION

echo "======================================================"
echo " Deployment initiated! Check status at:"
echo " http://aftershock-alb-1669511361.eu-west-2.elb.amazonaws.com/health"
echo "======================================================"