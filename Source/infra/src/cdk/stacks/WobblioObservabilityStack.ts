import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ce from 'aws-cdk-lib/aws-ce';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { EnvironmentConfig } from '../config/environment';
import { configParamName } from '../config/appConfig';
import { WobblioDbStack } from './WobblioDbStack';
import { applyWobblioTags } from '../utils/tagging';

interface WobblioObservabilityStackProps extends StackProps {
  config: EnvironmentConfig;
  dbStack: WobblioDbStack;
}

export class WobblioObservabilityStack extends Stack {
  readonly opsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: WobblioObservabilityStackProps) {
    super(scope, id, props);

    const { config, dbStack } = props;

    const opsEmail = ssm.StringParameter.valueForStringParameter(
      this,
      configParamName(config.stage, 'ops/email'),
    );

    // ── SNS Ops Topic ─────────────────────────────────────────────────────────
    this.opsTopic = new sns.Topic(this, 'OpsAlarmTopic', {
      topicName: `wobblio-ops-${config.stage}`,
      masterKey: dbStack.kmsKey,
    });
    this.opsTopic.addSubscription(new subscriptions.EmailSubscription(opsEmail));

    new CfnOutput(this, 'OpsTopicArn', {
      value: this.opsTopic.topicArn,
      exportName: `wobblio-${config.stage}-ops-topic-arn`,
    });

    // ── AWS Budgets (€30/month, alert at 50%/80%/100%) ───────────────────────
    const buildBudgetNotification = (
      threshold: number,
    ): budgets.CfnBudget.NotificationWithSubscribersProperty => ({
      notification: {
        notificationType: 'FORECASTED',
        comparisonOperator: 'GREATER_THAN',
        threshold,
        thresholdType: 'PERCENTAGE',
      },
      subscribers: [{ subscriptionType: 'EMAIL', address: opsEmail }],
    });

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `wobblio-monthly-${config.stage}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 30, unit: 'USD' },
      },
      notificationsWithSubscribers: [50, 80, 100].map(buildBudgetNotification),
    });

    // ── Cost Anomaly Detection (alert >€10/day) ───────────────────────────────
    // TEMPORARILY REMOVED (2026-07-02): the monitor CFN believed existed
    // (arn:aws:ce::837511507441:anomalymonitor/3578d128-acda-4e61-a8ec-cb547e7c0b96)
    // was gone from AWS (deleted out-of-band), so GetAtt MonitorArn failed on every
    // deploy. Deploying once with this removed clears the phantom CFN resource
    // record; restore this block and deploy again to recreate it fresh.
    // const anomalyMonitor = new ce.CfnAnomalyMonitor(this, 'CostAnomalyMonitor', {
    //   monitorName: `wobblio-anomaly-${config.stage}`,
    //   monitorType: 'DIMENSIONAL',
    //   monitorDimension: 'SERVICE',
    // });
    //
    // new ce.CfnAnomalySubscription(this, 'CostAnomalySubscription', {
    //   subscriptionName: `wobblio-anomaly-sub-${config.stage}`,
    //   monitorArnList: [anomalyMonitor.attrMonitorArn],
    //   subscribers: [{ address: opsEmail, type: 'EMAIL' }],
    //   threshold: 10,
    //   frequency: 'DAILY',
    // });

    // ── cdk-nag suppressions ──────────────────────────────────────────────────

    NagSuppressions.addResourceSuppressions(this.opsTopic, [
      { id: 'AwsSolutions-SNS2', reason: 'KMS encryption applied via masterKey prop' },
      { id: 'AwsSolutions-SNS3', reason: 'SNS enforces SSL in transit by default; no additional policy needed at MVP' },
    ]);

    applyWobblioTags(this, config);
  }
}
