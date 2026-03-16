#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();

new CognitoStack(app, 'HyraxFitnessCognito', {
  env: {
    account: '867259842081',
    region: 'us-east-1',
  },
  description: 'Hyrax Fitness - Cognito User Pool, Groups, and Lambda Triggers',
});
