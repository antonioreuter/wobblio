Quebrar o deploy em mais cloud formation stacks

- uma stack dedicada para o monitoramento
- uma stack dedicada para o bucket aonde processamos as invoices
- avaliar a aplicacao atual e ver como podemos quebrar ainda mais

CICD:
- Criar um gated pipeline to validate before merging the PR to Main branch
- Criar um pieline to deploy the application, first to the dev enviroment, and after human approaval deploy to production environment. Check the requirements to achieve that.

Layout
- Reavaliar completamente o layout da aplicacao. Ele esta muito aquem do que eu esperava. principalmente se compararmos com o do invoice comparator.  
