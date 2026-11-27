# Funis

**Marketing → Funis.** Ajuda para quem usa: aba **Ajuda**.

## Como funciona
- Cada funil tem uma lista. Começa quando alguém **entra na lista** ou quando alguém da lista **recebe uma etiqueta**. Formulário, API e webhook disparam o funil ao colocar a pessoa na lista ou na etiqueta (I3).
- O funil é um fluxograma em tela cheia: caixas ligadas por linhas, de cima para baixo. Caixas: enviar e-mail, esperar, condição (clicou, abriu, tem etiqueta; saídas Sim e Não), etiqueta (colocar ou tirar) e fim. Uma caixa sem linha de saída também encerra.
- Dá para desenhar tudo e escrever depois: a caixa de e-mail aceita rascunho sem conteúdo, e o conteúdo é escrito de dentro dela (vira um modelo).
- Para ativar: nenhuma caixa solta, condição com os dois lados ligados, nenhuma linha voltando para trás, todo e-mail com conteúdo.
- Armazenamento: `marketing_flows.steps` guarda `{start, nodes, edges}`. Funis do primeiro construtor (lista) são convertidos na leitura (`readGraph`).
- A tela usa `@xyflow/react` (MIT) com o selo oculto (`proOptions.hideAttribution`); os autores pedem assinatura Pro para ocultar.
- **Objetivo** (opcional): quem recebe a etiqueta escolhida sai, e o que estava na fila para essa pessoa não é enviado.
- Só entra quem chegar depois da primeira ativação. Cada pessoa passa uma vez por funil.
- Roda no agendamento de 1 minuto (`* * * * *`, só marketing), até 100 pessoas por passagem. Antes dos envios. Esperas de até 45 s são feitas dentro da própria passagem; as maiores ficam para a passagem seguinte. Unidades: segundos, minutos, horas e dias.

## Envio
Cada passo de e-mail é uma campanha oculta (`kind = 'flow'`). Por isso valem consentimento, descadastro, aquecimento, cota, disjuntor, ritmo por provedor, rastreio e devoluções.

- O limite semanal por pessoa **não** vale para funil: a sequência chegaria incompleta.
- A espera seguinte conta a partir de quando a mensagem realmente saiu.
- O conteúdo e o assunto são copiados na ativação. Mudou o modelo? Pause e ative de novo.

## Editar
Funil ativo não é editado: pause, mude e ative. Quem está num passo removido encerra o funil. Passos já feitos não se repetem.

## Referência
Funis prontos e objetivo vieram da comparação com o ActiveCampaign ([research.md](research.md)). Não há ainda: esperar até uma data ou condição, carrinho abandonado, "ir para", pontuação.

## Testar
O botão **Testar** (funil ativo) cadastra o próprio administrador como um lead (`POST /api/marketing/flows/[id]/test`, com confirmação de que os dados são dele), apaga o teste anterior daquela pessoa naquele funil e mostra cada envio e erro. As regras de envio continuam valendo (aquecimento, 8h às 20h no WhatsApp).

O teste fica aberto mesmo se você fechar a janela ou mudar de tela: o funil mostra **teste aberto** e o botão vira **Ver teste**. Só **Encerrar teste** o remove (e o que ainda não saiu para você deixa de sair).
