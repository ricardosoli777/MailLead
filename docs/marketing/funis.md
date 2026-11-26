# Funis

**Marketing → Funis.** Ajuda para quem usa: aba **Ajuda**.

## Como funciona
- Cada funil tem uma lista. Começa quando alguém **entra na lista** ou quando alguém da lista **recebe uma etiqueta**. Formulário, API e webhook disparam o funil ao colocar a pessoa na lista ou na etiqueta (I3).
- Passos: enviar e-mail, esperar, condição (clicou, abriu, tem etiqueta), etiqueta (colocar ou tirar) e sair. Depois de um dos lados da condição, o funil continua abaixo dela.
- **Objetivo** (opcional): quem recebe a etiqueta escolhida sai, e o que estava na fila para essa pessoa não é enviado.
- Só entra quem chegar depois da primeira ativação. Cada pessoa passa uma vez por funil.
- Roda no agendamento de 5 minutos, até 100 pessoas por passagem (cerca de 28 mil avanços por dia). Antes dos envios.

## Envio
Cada passo de e-mail é uma campanha oculta (`kind = 'flow'`). Por isso valem consentimento, descadastro, aquecimento, cota, disjuntor, ritmo por provedor, rastreio e devoluções.

- O limite semanal por pessoa **não** vale para funil: a sequência chegaria incompleta.
- A espera seguinte conta a partir de quando a mensagem realmente saiu.
- O conteúdo e o assunto são copiados na ativação. Mudou o modelo? Pause e ative de novo.

## Editar
Funil ativo não é editado: pause, mude e ative. Quem está num passo removido encerra o funil. Passos já feitos não se repetem.

## Referência
Funis prontos e objetivo vieram da comparação com o ActiveCampaign ([research.md](research.md)). Não há ainda: esperar até uma data ou condição, carrinho abandonado, "ir para", pontuação.
