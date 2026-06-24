CICD:
- Criar um gated pipeline to validate before merging the PR to Main branch
- Criar um pieline to deploy the application, first to the dev enviroment, and after human approaval deploy to production environment. Check the requirements to achieve that.

Onboarding:
- As mensagens de error nao esta mostrando a stack trace, isso é pessimo para troubleshooting.


Admin:
- Adicionar uma funçao para dar mais ou menos creditos de invoice para um usuario nao semana corrente. Em caso de falha em uma invoice a mesma nao deve ser contabilizada para deduzir do numero de invoices que um usuario pode submeter.

Dashboard:
- The top merchant should be defined by the sum of invoices per merchant and choose the merchant where you spent most money in the current month.
- Whe the invoice doesn't have the location confirmed, it is set to READY, however it is still pending confirmation of the address. We need to adjust the status/lable.
- What the status check details mean? Add a helper somewhere in the app to instruct customer what that status is all about. Maybe we could have a info icon (i) in the table or somewehere else that when clicked will show the explanation for all the statuses and the meaning. Adding an icon per row might be too much. This is a global information.

New features:
- Users should be able to add an expense manually without an invoice. In this case they can provide a description, a top level category, select the region, date and the currency and the value. Information like Currency we can default to his own currency, date could default to today's date. country and region could default to his country and region too. In this case we need to generate a generic invoice item with the same value of the expense and categorize with something like manual input expense (find a better name for that).


Admin:
- Adicionar uma funçao para dar mais ou menos creditos de invoice para um usuario nao semana corrente. Em caso de falha em uma invoice a mesma nao deve ser contabilizada para deduzir do numero de invoices que um usuario pode submeter.
- In the model matrix, add one entry related to the model used to process PDFs.
- Review the curation of products and the merge of different products.


WebApp UI:
- Standardize the icons for the invoices based on the Expense Category.
- In the dashboard, the chart "Spend over time" should have the option to see everything (in the last 3 months), but by default we should bring the expenses in the current month.
- Add a report to visualize the top 3 merchants. Show the top 3 merchants in the dashboard and the total amount spent in each of them for the current month.

Invoices:
- Define the max usage based on the number of invoices or credits (tokens) consumed per week. If the user in his last invoice exceeds to max credits available for that week, we still process the request, however if he has reached the limit already, we must reject the next invoices. We need to define how to define.

- A implementacao do household so vai permitir apenas mais duas pessoas, totalizando 3 pessoas, contando com o owner do household. O numero de invoices vai de 10 para 15 no maximo, quando operando com household.

- The strategy to deduce the location seems to be not working as expected. 
    1. Check if we can parse the address and correlate with a Country and Region [add tag informing that we resolved via invoice info], if not possible continue;
    2. If just the country matches, we should resolve the region based on the user's region preference, add a internal tag indicating this; [Note that we are introducing here an internal tag, which we don't have yet], if not possible continue;
    3. Ask the user to provide Country and Region in the frontend - we should bring pre populated the country and region based on the user's profile.

Budget:
 - [RESOLVED] Invoices uploaded are not being computed in the budget. Root cause: cycle_start
   defaulted to the creation day (CURRENT_DATE), so a mid-period budget's window
   [cycle_start, cycle_start + period) dropped every receipt issue-dated earlier in the
   period. Fix: anchor cycle_start to the calendar period start (DAY→today, WEEK→Monday,
   MONTH→1st) at creation, plus a backfill migration re-anchoring existing budgets.
   Covered by domain/service unit tests + BudgetCycleCalendarAnchor integration test.
