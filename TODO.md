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