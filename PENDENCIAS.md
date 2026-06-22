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


Database:

- Review the notification table. Messages should be deleted after 7 days.
- What the table system_counter represents? 
- What the table tenant_signature represents?
- How the table tenant_trust is used?
- The table Weekly advisor should keep the insights from the last 4 months.

- Maybe we should create one lambda to remove data that expired, this lambda can delete data from multiple tables. Next to that, we should have multiple cron triggers, one for each type of resource, the cron trigger calls the lambda, based on the alarm we know which table to remove the old data.
    - Analyze tables that could fit here.
    - Check if there is a better approach to remove old data.
     -> suggestions: notification, invoice_share, weekly_advisor
