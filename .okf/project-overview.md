---
type: Reference Manual
title: Project Overview, Features & Use Cases
description: Explains Wobblio's vision, core features, business model, and operational use cases.
tags: [product, features, business-model, use-cases]
timestamp: 2026-06-30T22:50:00Z
---

# Project Overview, Features & Use Cases

Wobblio is a cloud-native personal fiscal management utility designed to make receipt tracking, expense analysis, and shopping optimization effortless and highly accurate.

---

## 1. Project Vision

Wobblio converts photographed physical receipts, invoices, and restaurant bills into structured, classified, long-lived financial data. 

Unlike traditional expense tracking apps, Wobblio does not depend on fragile, permission-heavy bank feeds. Instead, it leverages advanced multimodal AI (AWS Bedrock) to parse images and reconstruct line items down to the exact unit size and cost.

Furthermore, every parsed receipt contributes anonymized price points to a regional price database. As users scan receipts, Wobblio aggregates this data into a crowdsourced local market price index. This independent index powers anti-inflation shopping list optimizations and budget forecasts that bank-feed competitors cannot reproduce.

---

## 2. Main Features

* **Zero Manual Entry AI Capture:** Photograph any receipt worldwide. The vision pipeline automatically extracts merchant, transaction date, line items, quantities, unit sizes, taxes, and totals into structured data. A simple, interactive review page lets users verify the details and provides feedback to keep the parsing models aligned.
* **Anti-Inflation Price Engine:** Wobblio tracks what users actually pay for products, per store, over time. It captures real shelf prices and in-store promotions in the local region rather than relying on scraped web prices (which often omit localized discounts).
* **Smart Route Shopping Lists:** When the price engine identifies that splitting a shopping list across multiple nearby stores (e.g., Albert Heijn and Lidl) saves more than a user-defined threshold, it splits the list into store-specific check-off lists and calculates the savings.
* **Proportional Bill Splitting:** Users can assign whole line items or fractions of items to different contacts (e.g., splitting a shared meal). Taxes, tips, and service fees scale proportionally to each person's subtotal. The split exports as a clean, copy-pasteable WhatsApp summary.
* **Cross-Border Currency Harmonization:** Receipts from foreign travel are automatically converted into the user’s home currency using the exchange rate active on the transaction date, ensuring historical comparisons remain accurate.

---

## 3. Core Use Cases

### 3.1 Personal Expense Tracking & Budgeting
* **Scenario:** A user wants to track their weekly grocery and household spending without typing line items.
* **Flow:** The user snaps photos of their weekly shopping receipts. The system categorizes the invoice, logs the items, and updates category-specific budget progress bars. The user receives alerts at 85% and 100% of their set budgets.

### 3.2 Crowdsourced Price Checks
* **Scenario:** A user is shopping for semi-skimmed milk and wants to know if they are paying a fair price.
* **Flow:** The user searches for the product concept. Wobblio displays a comparison chart containing the user's historical purchase prices plotted alongside the regional median price trend for that exact product over the last six months.

### 3.3 Shopping List Optimization (Split-Route)
* **Scenario:** A household has a shopping list of 15 items and wants to minimize cost.
* **Flow:** The user initiates "Optimize Route". The optimization service queries the Price Observation Store, maps the list items to nearby merchants, and partitions the list. It presents a route recommendation: *"Buy items 1-8 at Store A and items 9-15 at Store B to save €8.40."*

### 3.4 Proportional Bill Splitting
* **Scenario:** A group of friends finishes dinner and wants to split a long, complex bill.
* **Flow:** The user uploads the receipt. Once parsed, they assign specific lines (drinks, appetizers) to individual people and split the shared main dishes. The app applies the tax and tip fractions to each person’s subtotal and provides a copyable summary text for WhatsApp.

---

## 4. Marketing, Monetization & Billing

Wobblio employs a **Freemium B2C subscription** model. Standard (free) users are not dead weight; their receipt uploads provide the anonymized price data that seeds the regional market index, building the product’s competitive moat. Premium users pay for the advanced intelligence layers.

### 4.1 Plan Tiers
* **Standard (Free):** 3 invoice uploads/week, 3 active shopping lists, reporting limited to top-level totals for the current and previous month, single currency, no household sharing, and no route optimization.
* **Premium (€2.50/month or €25/year):** 10 uploads/week personal quota, 10 active lists, household sharing (up to 5 members, +20 uploads/week pooled quota), alerts, bill splitting, currency harmonization, split-route optimizer, and the Weekly AI Savings Advisor.

### 4.2 Web-Only Billing Routing Rule (Sales Channel)
Subscriptions are sold **only** via Stripe Checkout on the web application. The mobile apps do not offer in-app purchases. Instead, they deep-link users to the web upgrade flow or display a neutral plan-management notice. This ensures Wobblio bypasses the 15–30% mobile app store commission, preserving operating margins at this competitive price point.
