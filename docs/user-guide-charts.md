# Cifras e equipe

## Criar uma cifra

1. Abra **Cifras** e selecione uma música na biblioteca.
2. Clique em **Nova versão**. A letra é copiada para o editor; a música original e a projeção não são alteradas.
3. Dê um nome à versão. Use visibilidade **Pessoal** para seu rascunho ou **Igreja** quando tiver permissão para publicar.
4. Clique no ponto da letra em que o acorde deve entrar. Digite, por exemplo, `C`, `Am7` ou `D/F#`, e confirme em **Aplicar**.
5. Clique em um acorde para editar ou remover. Arraste-o até outra letra ou, com o acorde focado, use as setas esquerda/direita para deslocá-lo. Escape cancela o arraste.
6. Clique em **Salvar cifra**. As alterações são explícitas; cancelar permite descartar o rascunho.

A posição é ligada a caracteres visíveis da letra, incluindo acentos combinados e emojis, e não a espaços de uma fonte específica. Acordes e letras compartilham o mesmo trecho visual. Aumentar a fonte pode mudar as quebras de linha sem separar o acorde de sua âncora.

**Desfazer** e **Refazer** recuperam alterações da edição visual. Em **Sequência e notas**, repita uma parte, mova-a para antes ou remova uma ocorrência. Partes repetidas continuam vinculadas: editar um acorde na parte também modifica suas repetições. As notas da versão são salvas com a cifra.

## Tom real e capotraste

- **Tom declarado** é o tom que soa para a congregação.
- **Capotraste** informa a casa, de 0 a 5. Ao mudar o capo, o sistema recalcula as formas dos acordes para preservar o som real.
- **−½ / +½** transpõem o tom real em um semitom e ajustam os acordes. A nota de baixo de acordes como `D/F#` também é transposta.
- **Sugerir tom** examina os acordes. A sugestão é heurística, pode apresentar tons relativos e só entra na versão quando você confirma um candidato. Não há detecção pela letra nem análise de áudio.
- **Sugerir capotraste** apresenta opções calculadas localmente. Escolher uma muda o rascunho; salvar continua sendo necessário.

Exemplo: formas em C com capo na casa 2 soam em D. Mudar o capo não deve ser confundido com subir o tom da música.

Símbolos não reconhecidos podem gerar avisos em vez de transformações arriscadas. Revise a cifra antes de tocar.

## Importar e exportar

**Importar cifra** aceita ChordPro (`.cho`, `.chopro`, `.chordpro`, `.pro`) e texto (`.txt`) com cifras acima da letra. A importação entra no rascunho para revisão, sem salvar automaticamente.

**Editar ChordPro** abre uma área de texto com prévia imediata. Acordes usam colchetes, como `[C]Uma [G]linha`. Clique em **Aplicar ChordPro** para voltar à edição visual. A sequência exportada é expandida: editar e reaplicar o texto pode transformar repetições em partes independentes. Para manter partes vinculadas, prefira os controles de sequência da edição visual.

**Exportar rascunho** grava ChordPro. No aplicativo desktop, há um seletor nativo de arquivo. No navegador, o download é feito pelo próprio navegador. A exportação não salva a cifra na biblioteca.

No desktop, **Importar URL** aceita páginas públicas do Cifra Club. Marque a autorização somente quando tiver direito de importar o conteúdo. O acesso depende da disponibilidade e das regras do site: bloqueios e páginas não reconhecidas geram erro; use um arquivo ou cole a cifra que você está autorizado a utilizar. O LouvaShow não contorna proteções de acesso.

## Versões e alterações simultâneas

Uma música pode ter várias versões de cifra. **Duplicar** inicia outra versão, **Editar** altera uma existente e **Publicar na igreja** cria uma cópia compartilhada.

Se alguém salvar uma versão enquanto você edita a mesma revisão, o salvamento é recusado para evitar sobrescrever trabalho. Seu rascunho permanece aberto. É possível exportá-lo ou usar **Salvar rascunho como nova versão pessoal**.

Excluir uma cifra retira-a da lista; revisões já fixadas em repertórios são preservadas.

## Leitura no palco

**Abrir** mostra o visualizador. Cada painel possui seleção de cifra, fonte, tamanho, cores, tom e capo independentes. **Dois painéis** permite consultar duas cifras ao mesmo tempo. Em telas estreitas, os painéis ficam um sobre o outro.

Os controles do visualizador alteram somente a leitura atual. Não editam a versão salva nem a projeção. A revisão exibida aparece no cabeçalho. Preferências de fonte e cores são lembradas neste navegador/dispositivo; notas de dispositivo ficam vinculadas à cifra, sem aparecer em outras músicas.

**Modo palco** recolhe os controles. **Controles** os exibe novamente. Cada painel tem sua própria rolagem.

## Equipe e acesso pelo celular/tablet

1. No desktop, abra **Configurações → Equipe e acesso local**.
2. Cadastre cada pessoa com nome e e-mail. As funções, como vocal, guitarra e pastor, são rótulos de organização. Elas não concedem acesso administrativo.
3. A permissão **Pode publicar cifras da igreja** é separada das funções. Sem ela, a pessoa trabalha com versões pessoais e consulta as cifras compartilhadas.
4. Escolha a interface de rede e uma porta disponível. Confirme que está em uma rede local confiável e clique em **Ligar acesso local**.
5. Abra o endereço exibido em um aparelho na mesma rede. Informe o e-mail cadastrado e um nome para o dispositivo.
6. Confira presencialmente o código apresentado no aparelho e no desktop. Clique em **Atualizar dispositivos**, depois em **Aprovar** no pedido correto.

A aprovação do dispositivo permanece no servidor até sair ou revogar. O cookie persistente é renovado por até 400 dias ao consultar a sessão; o navegador pode limitá-lo ou removê-lo antes, exigindo novo pareamento. Pedidos ainda não aprovados expiram em dez minutos. **Revogar** retira seu acesso; **Sair** remove a sessão naquele navegador. **Desligar acesso** encerra o servidor local. O computador que executa o LouvaShow precisa permanecer ligado e acessível.

A conexão desta versão usa HTTP por endereço IP, sem criptografia TLS nem configuração automática de domínio. Use apenas uma rede confiável; não abra a porta para a internet. Esta primeira autorização confirma o dispositivo pelo código e não verifica a posse do e-mail por mensagem.

O visualizador pelo navegador não depende de Tauri. A instalação do aplicativo continua necessária no computador que mantém a biblioteca.

## Meus repertórios

No navegador da equipe, abra **Meus repertórios**, escolha **Novo repertório**, informe um nome e salve. Adicione cifras, inclusive mais de uma ocorrência da mesma cifra. As setas mudam a ordem e **Remover** retira somente aquele item. **Excluir repertório** apaga a lista após confirmação, mantendo as cifras.

Cada item fixa a revisão existente na inclusão. Uma edição posterior da cifra não troca silenciosamente a versão escolhida para o evento. **Abrir** respeita a revisão fixada. Para usar uma revisão nova, remova o item e adicione a cifra novamente.

**Iniciar repertório** abre o primeiro item em modo palco. Os controles discretos **Anterior / Próximo** percorrem a ordem e respeitam a revisão fixada de cada ocorrência, inclusive quando a mesma cifra se repete. Não há avanço automático no último item. No modo de dois painéis, a sequência controla somente o painel 1; o painel 2 continua independente.

Nesta versão, esses repertórios do músico são pessoais. O repertório de projeção no desktop é uma função separada.

## Foto da pessoa

O Gravatar é opcional. Habilite a preferência da pessoa e use **Consultar foto** no desktop para buscar a imagem. A consulta envia um identificador derivado do e-mail ao serviço externo, após confirmação. Nenhuma foto é buscada automaticamente ao abrir a tela.

## Assistente opcional

Em **Configurações → Assistente IA**, habilite apenas as funções desejadas e configure sua própria chave Groq. Sem chave ou com o assistente desligado, cifras, biblioteca, visualização e projeção funcionam normalmente. Chamadas à Groq precisam de internet e estão sujeitas às condições da sua conta.

- **Transcrição de áudio:** o botão compacto **Ditar** está nos campos título e artista da música e no nome do repertório desktop. Abra os controles, grave ou importe, revise a transcrição e confirme a inserção. Campos curtos recebem o texto acrescentado com espaço, sem substituir o que você digitou. Na letra, grave a voz ou selecione um arquivo de até 24 MB. Pare a gravação, ouça a prévia e confirme o envio. Revise o texto recebido e use **Inserir no campo**; a letra existente não é substituída.
- **Sugerir divisões · IA:** envia a letra após confirmação e apresenta as divisões para revisão. **Usar divisões** aplica as quebras ao campo. Depois revise os blocos e salve a música normalmente. Se você alterar a letra durante a análise, gere uma nova sugestão.
- **Ordenar sugestões de capotraste:** depois das sugestões locais no editor, **Ordenar com IA** envia somente os acordes e candidatos selecionados, após confirmação. A IA ordena opções; não salva nem aplica automaticamente.

A gravação depende da permissão de microfone e das APIs disponíveis na plataforma. Navegadores normalmente bloqueiam microfone em endereços HTTP de rede local. A interface de gravação desta versão é do desktop; a seleção de um arquivo é a alternativa quando a captura não está disponível. Nenhuma transcrição externa ocorre apenas por abrir o campo. Fechar o ditado, fechar o formulário ou desligar a transcrição interrompe os tracks do microfone; respostas pendentes não são inseridas automaticamente.

A chave configurada não é exibida novamente nem enviada aos navegadores da equipe. Use **Remover chave** para retirar a configuração deste computador.

## Limites de validação

Os testes automatizados de frontend cobrem âncoras por grafema, repetição vinculada, edição sem mudar letras e movimentação de acordes. Compilação e testes automatizados não substituem testes em dispositivos reais, microfone, rede, serviços externos ou segundo monitor. Consulte o README e as notas da versão para o estado de validação da distribuição.
