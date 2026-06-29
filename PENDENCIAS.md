CICD:
- Criar um gated pipeline to validate before merging the PR to Main branch
- Criar um pieline to deploy the application, first to the dev enviroment, and after human approaval deploy to production environment. Check the requirements to achieve that.

Onboarding:
- As mensagens de error nao esta mostrando a stack trace, isso é pessimo para troubleshooting.

Dashboard:


New features:
- Users should be able to add an expense manually without an invoice. In this case they can provide a description, a top level category, select the region, date and the currency and the value. Information like Currency we can default to his own currency, date could default to today's date. country and region could default to his country and region too. In this case we need to generate a generic invoice item with the same value of the expense and categorize with something like manual input expense (find a better name for that).


Admin:
- Review the curation of products and the merge of different products.


WebApp UI:

Invoices:
- Define the max usage based on the number of invoices or credits (tokens) consumed per week. If the user in his last invoice exceeds to max credits available for that week, we still process the request, however if he has reached the limit already, we must reject the next invoices. We need to define how to define.

Household:
- **Prevent invoice-quota gaming via household join/leave churn.**

  Define how weekly invoice quotas behave when users move in/out of households mid-week, plus abuse detection.

  Quota model (recap):
  - Standard solo: 3/week. Premium solo: 10/week.
  - Household shared pool = owner's cap +5 per additional member (premium owner + 1 member = 10 + 5 = 15).
  - Members inherit premium indirectly while in a premium-owned household.

  Walkthrough to handle:
  1. Premium user at 5/10 this week.
  2. Creates household, adds one member → pool becomes 5/15.
  3. Invited user is Standard, currently 2/3 this week.
  4. On join: member gains indirect premium and shares the pool (5/15).
  5. Member leaves same week → personal quota resumes prior state (2/3), loses premium.
  6. Household drops to owner only → pool reverts to owner's solo cap; with no uploads during the household, owner reads 5/10.
  7. Any invoice uploaded while the household exists is debited to the household pool; on dissolution that consumption rolls into the owner's personal weekly count.

  Required mechanism:
  - Exact count-transfer rules on join, leave, and dissolution — no invoice double-counted, lost, or reset to mint free quota.
  - Close the arbitrage vector: no extra capacity by repeatedly forming/dissolving households or cycling members within a week.

  Abuse detection & enforcement:
  - Structured log messages flagging suspicious churn (rapid join/leave, repeated create/dissolve, quota arbitrage).
  - On detection: warn the user to stop.
  - On continued abuse: escalate to account revocation.

  Open questions:
  - Accounting rule when household consumption exceeds the owner's solo cap on dissolution.
  - "Same week" = calendar-week boundary or rolling 7 days?
  - Thresholds (events per window) for warning vs. revocation.

  
- When sharing the link, add a button to share via whatsapp, like we do with the invoices.