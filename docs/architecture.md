# Decisões essenciais de arquitetura

## Monólito desktop modular

React/TypeScript compõe as interfaces, enquanto Rust concentra as operações nativas e a persistência. O SQLite fica no diretório de dados do aplicativo. Não há serviço HTTP de produção, conta obrigatória, telemetria ou dependência de IA em runtime.

As funcionalidades se organizam em músicas, repertório, apresentação, temas, mídia e telas à medida que recebem implementação real. Não se criam camadas vazias ou interfaces que apenas repassem chamadas.

## Três estados distintos

O formulário mantém o rascunho de edição; a interface do operador mantém a música preparada; o coordenador Rust mantém o conteúdo efetivamente projetado. Salvar, selecionar, buscar ou excluir uma música não deve substituir silenciosamente a apresentação.

Ao apresentar, o coordenador conserva uma cópia do conteúdo da música usada na sessão. Navegar opera nessa cópia, sem reler disco a cada bloco. Uma edição posterior não altera o conteúdo já projetado. A sessão dura enquanto o processo estiver aberto; persistir a sessão entre reinícios é uma evolução separada da biblioteca persistente.

## Snapshots e revisões

Toda mudança da apresentação produz um snapshot serializável com revisão monotônica. A janela registra o listener antes de solicitar o estado atual e aplica apenas revisões superiores à última aceita. Isso impede regressão quando a resposta da consulta chega depois de um evento mais recente.

O snapshot transporta o conteúdo necessário ao slide, não a biblioteca inteira. Reabrir a janela faz uma nova consulta ao coordenador. Eventos aceleram a atualização, mas não são a única fonte para reconstruir a saída.

## Persistência e identidades

Músicas, blocos e itens de repertório possuem identificadores estáveis. A posição determina ordenação e não identidade. Duas ocorrências da mesma música no repertório permanecem distintas.

O backend executa migrações versionadas, consultas parametrizadas, transações e foreign keys. Um banco inválido gera erro recuperável ou impede a inicialização; não autoriza reset silencioso. A interface salva formulários explicitamente. A exclusão de música deve informar antes a remoção de referências do repertório.

## Playlists por evento

Cada playlist é um `Setlist` nomeado, com itens independentes e identificador estável. O nome identifica o evento sem introduzir uma agenda. A playlist selecionada é persistida nas preferências locais; criar uma playlist também a seleciona. Renomear altera somente o nome.

Inclusão, remoção e reordenação de itens recebem `setlistId` explicitamente. O backend valida que os itens pertencem àquela lista e exige uma permutação completa na reordenação. Uma seleção diferente na interface não pode redirecionar uma operação pendente para outra lista. O frontend serializa as operações da biblioteca e desabilita a troca enquanto uma operação está em andamento.

Excluir a playlist ativa escolhe e persiste outra lista na mesma transação. A última playlist não pode ser excluída. Excluir uma playlist remove seus itens, preservando as músicas e o snapshot ao vivo. Excluir uma música da biblioteca remove suas ocorrências em todas as playlists e recompõe as posições das listas afetadas. Nenhuma dessas operações comanda a apresentação.

A exportação JSON/OpenLyrics atual intercambia músicas, não playlists, seleção ativa, temas ou sessão. Ela não representa um backup completo do banco local.

## Limite nativo e janelas

A janela do operador invoca operações explícitas. A projeção precisa apenas consultar e observar o estado. Capabilities e validações nativas devem impedir que a projeção altere a biblioteca, execute shell ou leia arquivos indiscriminadamente.

Uma única janela de projeção é reutilizada. A escolha de monitor é uma sugestão que precisa ser revalidada, nunca um índice fixo presumido. A preferência de monitor ainda não é persistida entre reinícios. A abertura em janela e a tela preta inicial permitem conferir a saída antes de mostrar conteúdo. A perda do monitor não deve descartar a sessão nem mover uma janela em tela cheia sobre os controles.

## Renderização

A prévia e a saída compartilham as regras do slide e um canvas 16:9, com barras pretas quando a proporção da janela difere. Letras são texto, nunca HTML. Fundo, contraste e texto têm responsabilidades separadas. Ajustes de legibilidade têm um mínimo de fonte: se um bloco não couber, a interface deve pedir sua divisão. Os temas de fundo sólido são persistidos nas preferências locais. Mídia de fundo é uma evolução futura; quando implementada, a troca de bloco não deverá recriar o vídeo.

Referências: [comandos Rust](https://v2.tauri.app/develop/calling-rust/), [eventos para o frontend](https://v2.tauri.app/develop/calling-frontend/), [capabilities](https://v2.tauri.app/security/capabilities/).
