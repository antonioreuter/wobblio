# Wobblio Project Analysis & Architecture Guide

## Executive Summary

**Wobblio** is a cloud-native personal fiscal management utility that transforms receipt photos into structured financial data. The system leverages multimodal AI (AWS Bedrock) to parse invoice images, extract merchant/product/amount data, and feed anonymized price observations into a crowdsourced regional price index that powers anti-inflation shopping optimization and budgeting features.

**Current Status:** Spec-complete (v2.4), implementation in Phase 2-3 (backend core logic + infra scaffolded; ingestion pipeline stubs in place; webapp early UI).

---

## High-Level Architecture

```mermaid
graph TB
    User["👤 User<br/>(Web/Mobile)"]
    Auth["🔐 AWS Cognito<br/>(Google/Meta federation)"]
    WebApp["🌐 Next.js Webapp<br/>(OpenNext SSR)"]
    AdminWeb["⚙️ Admin Console<br/>(phase 5)"]
    
    ApiGateway["🚪 API Gateway<br/>(Cognito authorizer)"]
    Lambda["⚡ Lambda Fleet<br/>(api-handler)"]
    
    SQS["📤 SQS Queue<br/>(ingestion jobs)"]
    IngestionWorker["🔄 Ingestion Worker<br/>(vision → merchant → product → tag)"]
    
    Bedrock["🧠 AWS Bedrock<br/>(Qwen, Haiku, Sonnet)"]
    Ollama["🎨 Ollama<br/>(local dev)"]
    
    RDS["🗄️ PostgreSQL 15<br/>(db.t3.micro)"]
    S3["🪣 S3 Bucket<br/>(receipt images)"]
    KMS["🔑 KMS CMK<br/>(envelope encryption)"]
    
    Stripe["💳 Stripe API<br/>(checkout, webhooks)"]
    SNS["📲 SNS<br/>(cost alerts, push)"]
    CloudWatch["📊 CloudWatch<br/>(structured logs, EMF metrics)"]
    
    User -->|sign in| Auth
    Auth -->|session| WebApp
    Auth -->|session| AdminWeb
    
    WebApp -->|POST /api/*| ApiGateway
    AdminWeb -->|POST /api/*| ApiGateway
    
    ApiGateway -->|IdToken| Lambda
    Lambda -->|query tenant data| RDS
    Lambda -->|presigned PUT| S3
    Lambda -->|publish| SQS
    Lambda -->|checkout session| Stripe
    
    SQS -->|consume| IngestionWorker
    IngestionWorker -->|vision parse| Bedrock
    IngestionWorker -->|OR fallback| Ollama
    IngestionWorker -->|upsert invoice| RDS
    IngestionWorker -->|store price obs| RDS
    
    Lambda -->|encrypt sensitive data| KMS
    IngestionWorker -->|cost tracking| CloudWatch
    Lambda -->|cost tracking| CloudWatch
    
    Stripe -->|webhook| Lambda
    Lambda -->|cost alert| SNS
    
    style User fill:#e1f5ff
    style Auth fill:#fff3e0
    style WebApp fill:#f3e5f5
    style Lambda fill:#e8f5e9
    style Bedrock fill:#fce4ec
    style RDS fill:#ede7f6
    style S3 fill:#ede7f6
