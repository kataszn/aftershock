#!/usr/bin/env bash
set -e

# Provisions the AWS-side telemetry infrastructure for Aftershock:
#   1. SSM parameters holding the CloudWatch agent scrape configs
#   2. IAM inline policies on the ECS task roles (PutMetricData + SSM read)
#   3. CloudWatch alarms on the three critical failure states
#
# Idempotent — safe to re-run. Requires the AWS CLI configured with an
# identity that can manage SSM, IAM, and CloudWatch in the target account.

AWS_REGION="${AWS_REGION:-eu-west-2}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-690039670036}"
API_TASK_ROLE="${API_TASK_ROLE:-aftershock-api-task-role}"
WORKER_TASK_ROLE="${WORKER_TASK_ROLE:-aftershock-worker-task-role}"
SNS_ALARM_TOPIC_ARN="${SNS_ALARM_TOPIC_ARN:-}"

export MSYS_NO_PATHCONV=1

echo "==> 1. Publishing CloudWatch agent configs to SSM Parameter Store..."
aws ssm put-parameter \
  --name "/aftershock/cw-agent-config-worker" \
  --type String \
  --value file://infra/cloudwatch/cw-agent-config-worker.json \
  --overwrite \
  --region "$AWS_REGION"

aws ssm put-parameter \
  --name "/aftershock/cw-agent-config-api" \
  --type String \
  --value file://infra/cloudwatch/cw-agent-config-api.json \
  --overwrite \
  --region "$AWS_REGION"

echo "==> 2. Attaching telemetry IAM policies to task roles..."
for ROLE in "$API_TASK_ROLE" "$WORKER_TASK_ROLE"; do
  aws iam put-role-policy \
    --role-name "$ROLE" \
    --policy-name aftershock-cloudwatch-metrics \
    --policy-document file://infra/iam/cloudwatch-metrics-policy.json

  aws iam put-role-policy \
    --role-name "$ROLE" \
    --policy-name aftershock-ssm-parameter-read \
    --policy-document file://infra/iam/ssm-parameter-read-policy.json
done

echo "==> 3. Creating CloudWatch alarms..."

# Optional alarm action (SNS topic) — only wired up if SNS_ALARM_TOPIC_ARN is set.
ALARM_ACTIONS=()
if [ -n "$SNS_ALARM_TOPIC_ARN" ]; then
  ALARM_ACTIONS=(--alarm-actions "$SNS_ALARM_TOPIC_ARN" --ok-actions "$SNS_ALARM_TOPIC_ARN")
fi

# 3a. Queue stagnation — the outbox relay has stalled or SQS is blocking writes.
aws cloudwatch put-metric-alarm \
  --alarm-name "aftershock-outbox-stagnation" \
  --alarm-description "Outbox pending batch exceeded 50 for 3 datapoints in 3 minutes — relay stalled or SQS blocking." \
  --namespace "Prometheus" \
  --metric-name "aftershock_outbox_pending_batch" \
  --statistic Maximum \
  --period 60 \
  --evaluation-periods 3 \
  --datapoints-to-alarm 3 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  "${ALARM_ACTIONS[@]}" \
  --region "$AWS_REGION"

# 3b. Delivery degradation — mass webhook failures (network egress or client outages).
aws cloudwatch put-metric-alarm \
  --alarm-name "aftershock-webhook-delivery-failures" \
  --alarm-description "More than 10 failed webhook deliveries in 5 minutes — egress or client endpoint failures." \
  --namespace "Prometheus" \
  --metric-name "aftershock_webhook_deliveries_total" \
  --dimensions Name=result,Value=failed \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  "${ALARM_ACTIONS[@]}" \
  --region "$AWS_REGION"

# 3c. Ingestion latency — USGS polling hanging, compromising the real-time promise.
#     Uses the summary's p90 quantile series (histograms are dropped by the agent).
aws cloudwatch put-metric-alarm \
  --alarm-name "aftershock-ingest-latency-p90" \
  --alarm-description "Ingest cycle p90 latency exceeded 30s — USGS polling is hanging." \
  --namespace "Prometheus" \
  --metric-name "aftershock_ingest_cycle_duration_seconds" \
  --dimensions Name=quantile,Value=0.9 \
  --statistic Average \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 30 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  "${ALARM_ACTIONS[@]}" \
  --region "$AWS_REGION"

echo "======================================================"
echo " Telemetry infrastructure provisioned."
echo " SSM:    /aftershock/cw-agent-config-{api,worker}"
echo " IAM:    aftershock-cloudwatch-metrics, aftershock-ssm-parameter-read"
echo " Alarms: aftershock-outbox-stagnation,"
echo "         aftershock-webhook-delivery-failures,"
echo "         aftershock-ingest-latency-p90"
echo "======================================================"
