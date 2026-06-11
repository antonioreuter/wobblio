# Serverless IaC Architect

Specialized guidelines for authoring AWS CDK/SAM templates, defining IAM policies under least privilege, and ensuring VPC and security parameters isolation.

## Instructions
1. Ensure the RDS PostgreSQL instance is deployed in private VPC subnets with no public access.
2. Implement strict IAM least-privilege policies. Never use wildcard resource actions (`"*"`) unless absolutely unavoidable.
3. Ensure the S3 bucket blocks all public access and generates presigned URLs with a maximum 5-minute TTL.
4. Secure API Gateway endpoints using Cognito User Pool authorizers and configure rate limiting/usage plans.
