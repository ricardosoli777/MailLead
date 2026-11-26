# Pesquisa: como outras ferramentas montam funis de e-mail

Feita em 2026-11-26, por busca na web. Base: trechos de resultados, com várias fontes de terceiros; a central de ajuda do ActiveCampaign recusou a leitura direta (403). Conferir os detalhes antes de tratá-los como fato.

## O que se repete
Um funil é um **gatilho** seguido de **passos** em um quadro visual.

| Peça | Exemplos |
|------|----------|
| Gatilho | entrou na lista, recebeu etiqueta, formulário, webhook, abriu, clicou, comprou, data |
| Ação | enviar e-mail, adicionar ou remover etiqueta, mover de lista, pontuar, webhook |
| Espera | período fixo, dia e hora, ou até uma condição (com prazo máximo) |
| Condição | dois caminhos (sim e não) por comportamento ou dado do contato |
| Controle | ir para um passo, meta que pula passos, sair do funil |

## Por ferramenta
- **ActiveCampaign:** quadro vertical, passos inseridos pelo "+" entre blocos; esperas, se/senão, "ir para" e metas. Vários gatilhos por automação. ([ações](https://help.activecampaign.com/hc/en-us/articles/218251828-Automation-actions-explained), [guia de terceiro](https://aiproductivity.ai/guides/activecampaign-automation-builder-guide/))
- **Mautic:** arrastar e soltar decisões (algo que o contato faz), ações e condições; decisões e condições têm sim e não. Depende de tarefa agendada. ([documentação](https://docs.mautic.org/en/6.0/_sources/campaigns/campaign_builder.rst.txt))
- **Mailing Boss (Builderall):** gatilho por inscrição ou etiqueta; passos adicionados pelo "+", blocos movíveis; condição por etiqueta com espera por caminho. ([workflows](https://knowledgebase.builderall.com/docs/understanding-mailingboss-5-workflows/))
- **Brevo e MailerLite:** construtor visual com ramificações e esperas; os limites por plano divergem entre as fontes.

## O que adotar no MailLead
Quadro vertical simples, com poucos blocos e linguagem clara. É o que evita a complexidade que o dono apontou no Mautic.

| Bloco | Primeira versão | Depois |
|-------|-----------------|--------|
| Gatilho | entrou na lista, recebeu etiqueta | formulário, webhook, clique, data |
| Ação | enviar modelo, adicionar/remover etiqueta, mover de lista | WhatsApp, webhook de saída |
| Espera | N horas ou dias | dia e hora, até condição |
| Condição | abriu, clicou, tem etiqueta (sim/não) | campos e pontuação |
| Saída | sair do funil | metas e "ir para" |

Abertura é aproximada (proxies de privacidade); condições importantes devem preferir clique ou etiqueta.

## Arrastar e soltar (pedido do dono, 2026-11-26)
- Paleta de blocos ao lado; arrastar para um ponto "+" entre passos, ou clicar no "+" (celular e teclado).
- Arrastar um passo existente para reordenar; condição abre as colunas "Sim" e "Não".
- Salvar como rascunho; só ativar um funil sem erros (passo de e-mail sem modelo, espera vazia).
- Ativo: quem já está dentro não é reenviado para passos concluídos.
