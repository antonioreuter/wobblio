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

