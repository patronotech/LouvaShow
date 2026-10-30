# Decisões essenciais de arquitetura

## Monólito desktop modular

React/TypeScript compõe as interfaces, enquanto Rust concentra as operações nativas e a persistência. O SQLite fica no diretório de dados do aplicativo. O núcleo não exige conta, telemetria ou IA. A versão 0.6.0 adiciona um servidor HTTP embutido e opcional para a equipe na LAN, desligado por padrão; ele não participa da sincronização entre operador e projeção. Groq e Gravatar são integrações externas opt-in.

As funcionalidades se organizam em músicas, repertório, apresentação, temas, mídia e telas à medida que recebem implementação real. Não se criam camadas vazias ou interfaces que apenas repassem chamadas.

## Três estados distintos

O formulário mantém o rascunho de edição; a interface do operador mantém a música preparada; o coordenador Rust mantém o conteúdo efetivamente projetado. Salvar, selecionar, buscar ou excluir uma música não deve substituir silenciosamente a apresentação.

Ao apresentar, o coordenador conserva uma cópia do conteúdo da música usada na sessão. Navegar opera nessa cópia, sem reler disco a cada bloco. Uma edição posterior não altera o conteúdo já projetado. A sessão dura enquanto o processo estiver aberto; persistir a sessão entre reinícios é uma evolução separada da biblioteca persistente.

## Contextos do operador

O módulo Bíblia mantém sua consulta separada da preparação musical. Versões, livros e capítulos são lidos por comandos Rust somente do operador. As traduções autorizadas são recursos imutáveis incorporados ao executável; não entram nas tabelas de músicas e não exigem download durante o uso. Cada edição preserva identificação, licença, atribuição e procedência próprias. Os textos passam por validação estrutural antes de serem expostos à interface.

Apresentar um versículo cria uma sequência de páginas do capítulo no mesmo coordenador Rust da apresentação. O snapshot leva texto, referência e identificação da tradução, sem exigir acesso ao catálogo pela janela de saída. A navegação fica limitada a esse capítulo; preparar outro livro ou versão não muda o que está ao vivo. Versículos longos são divididos em limites de palavras e identificados por parte, preservando seu texto. A referência ocupa uma área reservada no componente de slide compartilhado entre prévia e projeção.

A navegação entre Operação ao vivo, Repertórios, Músicas, Bíblia e Configurações é estado de interface e não envia comandos de apresentação. A música preparada e o snapshot permanecem no componente do operador. A área Músicas renderiza os blocos como conteúdo de revisão, sem ação de projetar. Atalhos de apresentação são limitados aos contextos ao vivo e Bíblia; os controles explícitos da barra de operação continuam disponíveis nos demais contextos.

As dimensões e o recolhimento dos painéis são preferências de interface versionadas por contexto no armazenamento local da WebView. Não alteram músicas, repertórios ou temas do SQLite. A leitura valida tipos, versão e números finitos e limita as dimensões. O ajuste automático à largura disponível não sobrescreve as dimensões preferidas. O arraste só persiste ao terminar; Escape, cancelamento do ponteiro, perda de captura ou foco restauram o estado anterior. Painéis recolhidos usam `hidden` e `inert` para retirar seus controles da navegação por teclado.

## Snapshots e revisões

Toda mudança da apresentação produz um snapshot serializável com revisão monotônica. A janela registra o listener antes de solicitar o estado atual e aplica apenas revisões superiores à última aceita. Isso impede regressão quando a resposta da consulta chega depois de um evento mais recente.

O snapshot transporta o conteúdo necessário ao slide, não a biblioteca inteira. Reabrir a janela faz uma nova consulta ao coordenador. Eventos aceleram a atualização, mas não são a única fonte para reconstruir a saída.

## Persistência e identidades

Músicas, blocos e itens de repertório possuem identificadores estáveis. A posição determina ordenação e não identidade. Duas ocorrências da mesma música no repertório permanecem distintas.

O backend executa migrações versionadas, consultas parametrizadas, transações e foreign keys. Um banco inválido gera erro recuperável ou impede a inicialização; não autoriza reset silencioso. A interface salva formulários explicitamente. A exclusão de música deve informar antes a remoção de referências do repertório.

## Repertórios por evento

Cada repertório é um `Setlist` nomeado, com itens independentes e identificador estável. O nome identifica o evento sem introduzir uma agenda. O repertório selecionado é persistido nas preferências locais; criar um repertório também o seleciona. Renomear altera somente o nome.

Inclusão, remoção e reordenação de itens recebem `setlistId` explicitamente. O backend valida que os itens pertencem àquela lista e exige uma permutação completa na reordenação. Uma seleção diferente na interface não pode redirecionar uma operação pendente para outra lista. O frontend serializa as operações da biblioteca e desabilita a troca enquanto uma operação está em andamento.

Excluir o repertório ativo escolhe e persiste outra lista na mesma transação. O último repertório não pode ser excluído. Excluir um repertório remove seus itens, preservando as músicas e o snapshot ao vivo. Excluir uma música da biblioteca remove suas ocorrências em todos os repertórios e recompõe as posições das listas afetadas. Nenhuma dessas operações comanda a apresentação.

A exportação JSON/OpenLyrics atual intercambia músicas, não repertórios, seleção ativa, temas ou sessão. Ela não representa um backup completo do banco local.

## Limite nativo e janelas

A janela do operador invoca operações explícitas. A projeção precisa apenas consultar e observar o estado. Capabilities e validações nativas devem impedir que a projeção altere a biblioteca, execute shell ou leia arquivos indiscriminadamente.

Uma única janela de projeção é reutilizada. A escolha de monitor é uma sugestão que precisa ser revalidada, nunca um índice fixo presumido. A preferência de monitor ainda não é persistida entre reinícios. A abertura em janela e a tela preta inicial permitem conferir a saída antes de mostrar conteúdo. A perda do monitor não deve descartar a sessão nem mover uma janela em tela cheia sobre os controles.

## Renderização

A prévia e a saída compartilham as regras do slide e um canvas 16:9, com barras pretas quando a proporção da janela difere. Letras são texto, nunca HTML. Fundo, contraste e texto têm responsabilidades separadas. Ajustes de legibilidade têm um mínimo de fonte: se um bloco não couber, a interface deve pedir sua divisão. Os temas de fundo sólido são persistidos nas preferências locais. Mídia de fundo é uma evolução futura; quando implementada, a troca de bloco não deverá recriar o vídeo.

Referências: [comandos Rust](https://v2.tauri.app/develop/calling-rust/), [eventos para o frontend](https://v2.tauri.app/develop/calling-frontend/), [capabilities](https://v2.tauri.app/security/capabilities/).

## Prévia de tema e caixa de texto

O formulário mantém um rascunho independente do tema aplicado. Alterações de campos e geometria renderizam uma cópia de prévia, sem comandos nativos; somente Aplicar à saída envia o tema ao coordenador. O snapshot real continua alimentando a prévia ao vivo e a projeção. Erros de aplicação preservam o rascunho para nova tentativa.

`Theme.textBox` representa x, y, largura e altura em percentuais do canvas, com mínimo de 10% por dimensão e limites finitos dentro de 0–100. Temas anteriores recebem o padrão 7/7/86/86 na desserialização, sem apagar preferências existentes. Para Bíblia, o renderer e o editor compartilham a geometria efetiva que reserva os 19% inferiores à referência. As alças pertencem somente ao operador; a saída mantém renderização enxuta.

## Estilo por bloco de música

A migração 5 acrescenta `song_blocks.style_override_json`, opcional e versionado. O objeto de versão 1 aceita somente caixa de texto, família e tamanho da fonte, cor do texto, alinhamento horizontal e posição vertical. Campos ausentes ou nulos herdam o tema global; fundo e transição continuam globais. A aplicação do estilo é a combinação do tema base com esses campos, compartilhada pela prévia e pela saída.

O comando `save_block_style` recebe os identificadores da música e do bloco, o estilo opcional e `applyToLive`. Salvar persiste o estilo no SQLite sem substituir o tema global. Remover o estilo devolve o bloco à herança global. A edição da letra preserva o estilo dos blocos cujo ID permanece; blocos novos começam sem estilo próprio e a remoção de um bloco elimina apenas sua configuração.

Ao apresentar uma música, cada `PresentationBlock` recebe uma cópia do estilo salvo. A navegação usa essa cópia, sem buscar o banco. Salvar um estilo com `applyToLive: false` não altera a sessão. Com aplicação explícita, o coordenador atualiza somente o estilo do bloco que ainda é o atual e pertence à mesma música; preserva o texto copiado, a saída apagada, o tema global e os outros blocos. Se o operador já navegou, o estilo fica salvo para a próxima apresentação e não afeta o novo bloco ao vivo.

Essa personalização existe somente para blocos de músicas. Passagens bíblicas continuam usando o tema global e a área reservada da referência. A importação e a exportação atuais de músicas não transportam estilos por bloco; não equivalem a um backup dessas configurações.
