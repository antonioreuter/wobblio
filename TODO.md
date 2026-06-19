Quebrar o deploy em mais cloud formation stacks

- uma stack dedicada para o monitoramento
- uma stack dedicada para o bucket aonde processamos as invoices
- avaliar a aplicacao atual e ver como podemos quebrar ainda mais

CICD:
- Criar um gated pipeline to validate before merging the PR to Main branch
- Criar um pieline to deploy the application, first to the dev enviroment, and after human approaval deploy to production environment. Check the requirements to achieve that.

Onboarding:
- O formulario de onboarding nao tem um campo para o usuario informar a regiao.
- Atualize o seed dos paises referente as regioes, UK esta subdividido por England, Scotland, Wales and Northern Ireland. Talvez seja melhor remover UK e adicionar apenas England e as regioes de England.
- As mensagens de error nao esta mostrando a stack trace, isso é pessimo para troubleshooting.


Admin:
Adicionar uma funçao para dar mais ou menos creditos de invoice para um usuario nao semana corrente. Em caso de falha em uma invoice a mesma nao deve ser contabilizada para deduzir do numero de invoices que um usuario pode submeter.

Invoice:
- Categorize the products, like vegetables and fruits, dairy, meat, etc. Something like that, feel free to come up with better classification.
- Add test cases for the invoice generation, for example so we can ensure the parser is working.
- Include the location in the invoice header


Cost:
KMS key can be very expensive. How often do we invoke them, and is there an alternative to them or to mitigate the cost?

New features:
- Users should be able to add an expense manually without an invoice. In this case they can provide a description, a top level category, select the region, date and the currency and the value. Information like Currency we can default to his own currency, date could default to today's date. country and region could default to his country and region too. In this case we need to generate a generic invoice item with the same value of the expense and categorize with something like manual input expense (find a better name for that).
