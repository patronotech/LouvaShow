# Cifras e equipe

Guia da versão 0.7.0.

## Criar uma cifra

1. Abra **Cifras** e selecione uma música na biblioteca.
2. Clique em **Nova versão**. A letra é copiada para o editor; a música original e a projeção não são alteradas.
3. Dê um nome à versão. Use visibilidade **Pessoal** para seu rascunho ou **Igreja** quando tiver permissão para publicar.
4. Clique na coluna da faixa acima da letra ou em **＋ Acorde**. Digite, por exemplo, `C`, `Am7` ou `D/F#`, ajuste **Coluna da faixa** e confirme em **Aplicar acorde**.
5. Clique em um acorde para editar. Arraste-o para outra coluna ou linha. Pelo teclado, foque o acorde e use esquerda/direita; Shift + seta move cinco colunas, Enter abre a edição e Delete/Backspace remove. Escape cancela o arraste.
6. Clique em **Salvar cifra**. As alterações são explícitas; cancelar permite descartar o rascunho.

Há oito posições antes da primeira palavra e oito após a frase, para acordes de preparação e passagem. Esses acordes são preservados ao salvar e exportar.

A edição usa faixas monoespaçadas: acordes acima, letra abaixo. A coluna conta caracteres visíveis, incluindo acentos combinados e emojis. Linhas instrumentais também mantêm posições para os acordes. Confira a faixa ao deslocar um acorde; aumentar o tamanho da fonte não altera sua coluna no documento.

## Linhas e partes

- Use o lápis **Editar letra** para alterar uma linha. Enter ou **Dividir no cursor** cria a próxima linha a partir daquele ponto. **Unir à próxima** junta as linhas; **Concluir letra** fecha o campo.
- **＋ Linha** insere uma linha; o botão de remoção retira a linha com seus acordes. Confira as âncoras após alterar o texto.
- **＋ Parte** cria uma seção. Edite seu nome, como Verso, Refrão ou Ponte. Para separar um trecho existente, marque linhas consecutivas da mesma parte, informe o nome e clique em **Criar parte**.
- **Remover parte** retira a seção e suas ocorrências na sequência. Use **Desfazer** se necessário, antes de encerrar o editor.

**Desfazer** e **Refazer** recuperam alterações da edição visual. Em **Sequência e notas**, repita uma parte, mova-a para antes ou remova uma ocorrência. Partes repetidas continuam vinculadas: editar um acorde na parte também modifica suas repetições. As notas da versão são salvas com a cifra.

## Tom real e capotraste

- **Tom declarado** é o tom que soa para a congregação.
- **Capotraste** informa a casa, de 0 a 5. Ao mudar o capo, o sistema recalcula as formas dos acordes para preservar o som real.
- **−½ / +½** transpõem o tom real em um semitom e ajustam os acordes. A nota de baixo de acordes como `D/F#` também é transposta.
- **Sugerir tom** examina os acordes. A sugestão é heurística, pode apresentar tons relativos e só entra na versão quando você confirma um candidato. Não há detecção pela letra nem análise de áudio.
- **Sugerir capotraste** apresenta opções calculadas localmente. Escolher uma muda o rascunho; salvar continua sendo necessário.

Exemplo: formas em C com capo na casa 2 soam em D. Mudar o capo não deve ser confundido com subir o tom da música.

Símbolos não reconhecidos podem gerar avisos em vez de transformações arriscadas. Revise a cifra antes de tocar.

## Colar cifras e importar texto

1. Clique em **Colar cifra**. Copie somente conteúdo que você tenha autorização para usar, inclusive de páginas do Cifra Club.
2. Escolha **Acordes acima da letra** e cole mantendo os espaços. Não cole apenas a URL: o LouvaShow não acessa nem extrai páginas por endereço.
3. Clique em **Revisar colagem**. Confira letra, acentos, colunas, trechos instrumentais e partes como `[Refrão]`, `[Segunda Parte]`, Intro e Final.
4. Clique em **Usar esta cifra** para substituir o rascunho. Para gravar na biblioteca, clique em **Salvar cifra**.

Se alterar o texto colado, revise novamente antes de aplicar. **Cancelar importação** mantém a cifra que estava no editor. A colagem normaliza quebras de linha, tabulações e caracteres invisíveis comuns sem buscar conteúdo na internet.

**Importar documento** no desktop, ou **Importar arquivo** no navegador da equipe, aceita ChordPro (`.cho`, `.chopro`, `.chordpro`, `.pro`) e texto (`.txt`) com cifras acima da letra. Esses formatos passam pela mesma revisão e não precisam de IA.

**ChordPro** abre o documento em texto. Acordes usam colchetes, como `[C]Uma [G]linha`. Após editar, clique em **Revisar colagem** e **Usar esta cifra**. A sequência exportada é expandida: editar e reaplicar o texto pode transformar repetições em partes independentes. Para manter partes vinculadas, prefira os controles de sequência da edição visual.

**Exportar** grava ChordPro. No aplicativo desktop, há um seletor nativo de arquivo. No navegador, o download é feito pelo próprio navegador. A exportação não salva a cifra na biblioteca.

## Importar PDF, DOC e DOCX

No desktop, selecione o arquivo em **Importar documento**. DOCX permite extração local ou **Extrair com IA**; PDF e DOC antigo precisam da interpretação externa. Clique em **Extrair e revisar**, confirme o envio quando houver IA e compare a prévia com o original. Só **Usar esta cifra** altera o rascunho; **Salvar cifra** grava a revisão. Leia também os avisos e as observações importadas.

O limite é 12 MiB por arquivo e 20 páginas por PDF. A importação local de DOCX lê texto, sem reproduzir imagens nem todo o leiaute. DOC antigo usa OpenAI; para Gemini, converta antes para PDF, DOCX ou TXT. Para preservar o aspecto visual de uma cifra em documento, prefira PDF.

Em **Configurações → Assistente IA → Documentos · OpenAI e Gemini**, o operador habilita a função, guarda as chaves no cofre do sistema e salva o provedor/modelo preferido. IA começa desligada. **Automático** respeita essa preferência; se ela também for automática, escolhe Gemini quando disponível, exceto DOC antigo, que exige OpenAI. Uma falha não provoca envio automático a outro serviço.

Gemini usa **3.8 Flash** por padrão e oferece **3.5 Flash-Lite** como opção econômica. OpenAI usa **GPT-5.4 mini**. A interpretação pode errar letra, acorde ou posição: a revisão é obrigatória. Consulte [Importação de documentos](document-import.md) para limites, dados enviados e custos. Configuração de chaves e importação desses documentos ficam no desktop do operador.

## Versões e alterações simultâneas

Uma música pode ter várias versões de cifra. **Duplicar** inicia outra versão, **Editar** altera uma existente e **Publicar na igreja** cria uma cópia compartilhada.

Se alguém salvar uma versão enquanto você edita a mesma revisão, o salvamento é recusado para evitar sobrescrever trabalho. Seu rascunho permanece aberto. É possível exportá-lo ou usar **Salvar como nova versão pessoal**.

Excluir uma cifra retira-a da lista; revisões já fixadas em repertórios são preservadas.

## Leitura no palco

**Abrir** mostra o visualizador. **Dois painéis** permite consultar duas cifras ao mesmo tempo, com seleção, aparência, tom e capo independentes. Em telas estreitas, os painéis ficam um sobre o outro.

Os controles alteram somente a leitura atual. Não editam a versão salva nem a projeção. A revisão exibida aparece no cabeçalho.

**Palco** recolhe os controles. **Controles** os exibe novamente. Cada painel tem sua própria rolagem.

A barra de partes leva diretamente a Verso, Refrão, Ponte e demais trechos. Ela acompanha a sequência: se o refrão aparece duas vezes, cada ocorrência tem seu próprio destino. Clicar em uma parte move somente a leitura daquele painel, sem enviar conteúdo à projeção.

### Cores e tipografia

O padrão de leitura é **Claro**, com letra grafite e acordes laranja escuro. Escolha **Escuro**, **Claro** ou **Contraste** na barra do leitor. O escuro usa acordes em laranja claro; o alto contraste mantém fundo preto e acordes amarelos. Esses três presets mudam as cores de letra, acordes e fundo, preservando os ajustes de tipografia. São independentes do tema da interface do operador.

Na engrenagem **Personalizar leitura**, ajuste a fonte, o tamanho e o peso da letra, o tamanho e o peso dos acordes, suas cores, o fundo e a **Distância acorde–letra**. A leitura acompanha as mudanças imediatamente. **Salvar definição** guarda o conjunto personalizado; **Cancelar** ou Escape descarta os ajustes dessa janela.

Depois de salvar, **Minha** restaura a última definição personalizada, mesmo após usar outro preset. As preferências ficam separadas por pessoa e painel neste navegador/dispositivo; não são transferidas para outro aparelho.

### Nota pessoal

O ícone **Notas desta cifra** abre uma nota adesiva opcional. Digite livremente; o texto é guardado localmente enquanto você escreve. Arraste a alça **Nota** para movê-la. Pelo teclado, foque a alça e use as setas; Shift + seta aumenta o deslocamento e Escape cancela um arraste em andamento.

**−** minimiza a nota, **＋** expande e **×** oculta sem apagar o texto. O ícone de notas a reabre. A nota pode permanecer visível no modo palco, sem ocupar uma faixa fixa da cifra.

Texto, posição e estado da nota ficam vinculados à pessoa e à cifra neste navegador/dispositivo. Trocar de música não leva a anotação para a próxima cifra. Ela não é enviada à projeção nem sincronizada entre aparelhos. Limpar o armazenamento do navegador remove essas preferências e notas locais. As **Notas da versão**, salvas no editor de cifras, continuam sendo um conteúdo separado da nota pessoal.

## Equipe e acesso pelo celular/tablet

1. No desktop, abra **Configurações → Equipe e acesso local**.
2. Cadastre cada pessoa com nome e e-mail. As funções, como vocal, guitarra e pastor, são rótulos de organização. Elas não concedem acesso administrativo.
3. A permissão **Pode publicar cifras da igreja** é separada das funções. Sem ela, a pessoa trabalha com versões pessoais e consulta as cifras compartilhadas.
4. Escolha a interface de rede e uma porta disponível. Confirme que está em uma rede local confiável e clique em **Ligar acesso local**.
5. Abra o endereço exibido, ou escaneie o QR Code, em um aparelho na mesma rede. Use a interface Wi-Fi/Ethernet da igreja; 127.0.0.1 é acesso somente neste computador. Informe o e-mail cadastrado e um nome para o dispositivo.
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

Há testes automatizados para âncoras por grafema, colagem, partes, edição de linhas e movimentação de acordes. Isso não comprova uso real em Windows, macOS Intel, dispositivos da equipe ou projetores. Não houve chamada real validada aos provedores de IA nesta implementação. Consulte o README, a matriz de validação e as notas da versão para os ensaios de interface e os resultados de cada distribuição.

## Barra de projeção

Arraste a borda superior da barra inferior para ajustar sua altura; **Ocultar** recolhe os controles. **Mostrar controles de projeção** os reabre. Na borda, as setas ajustam a altura, Home/End vão aos limites, Enter recolhe e Escape cancela o arraste. A altura e a visibilidade ficam salvas neste dispositivo.
