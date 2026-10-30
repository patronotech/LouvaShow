# Roteiro de validação

Este arquivo define os ensaios necessários. Uma caixa vazia significa que não há resultado registrado aqui; não significa aprovação. Registre sistema, versão, hardware, comando e resultado ao executar. Testes automatizados e build não substituem a observação da saída real.

## Versão 0.7.0 — 30/10/2026

No macOS Apple Silicon, a suíte frontend passou com 141 testes e o TypeScript estrito/Vite compilou. A suíte Rust pública passou com 92 testes; Clippy sem avisos e formatação passaram. Seis testes do finalizador de atualização passaram, incluindo assinatura temporária, adulteração, vínculo da versão, tar sanitizado e leitura PE. Nenhuma chave real aparece nas fixtures.

Na instância desktop isolada, foram conferidos os três temas, colagem/revisão e cadastro de cifra, persistência após reiniciar, deslocamento de acorde entre linhas, criação de parte, navegação por partes e confirmação de descarte mantendo o rascunho. A prévia ao vivo permaneceu separada da edição. Os testes utilizaram janelas no mesmo monitor.

Componentes reais foram conferidos também em uma página temporária isolada de QA, sem comandos nativos ou banco de usuário: créditos nos tamanhos 1360×860 e 760×600; tipografia independente (letra 14 px, acorde 48 px, peso 800 e distância 32 px), prévia/Cancelar, Salvar e reabrir; post-it, movimento por teclado, minimizar, ocultar e recuperar texto; altura/recolhimento da barra inferior e persistência; inserção de acorde antes/depois da frase preservando as âncoras existentes. A página temporária foi removida. Esses resultados de navegador não substituem ensaio nativo completo de todos os controles.

O TXT real fornecido pelo mantenedor passou por uma prova Rust temporária somente de leitura, fora das fixtures públicas: quatro partes nomeadas, 28 linhas, 57 acordes e seis diagramas separados em notas. Letras, colunas, ordem e metadados sobreviveram à exportação/reimportação ChordPro. O arquivo original permaneceu intacto; o teste temporário foi removido e a restauração do fonte foi confirmada por hash.

Não foram executadas chamadas pagas de OCR/IA nem uma atualização instalada de ponta a ponta. Windows 10/11, Mac Intel, Linux/Wayland e projetor físico não foram operados nesta sessão. A versão 0.7.0 introduz o atualizador; versões anteriores precisam de uma instalação manual inicial.

## Registro da primeira sessão — 29/10/2026

No macOS, a revalidação final concluiu TypeScript estrito, Vite, oito testes TypeScript e oito testes Rust. `cargo clippy --all-targets --locked -- -D warnings` passou sem avisos. O build Tauri de depuração gerou um aplicativo de 28,08 MiB. Esse tamanho se refere ao artefato local observado, não ao consumo de memória. A inspeção do bundle encontrou somente `Contents/MacOS/louvashow` e `Contents/Info.plist`.

Na interface nativa, foram observados a abertura do aplicativo, o cadastro de demonstração, o repertório e a janela de saída preta. A demonstração e o repertório persistiram após reiniciar o aplicativo. O primeiro bloco e o avanço ao próximo foram confirmados visualmente na janela de saída; fechar essa janela foi refletido como saída desconectada no operador, preservando a sessão.

Ao reabrir a saída, o segundo bloco foi recuperado e confirmado pela árvore de acessibilidade da janela. Apagar produziu uma janela de projeção inteiramente preta, confirmada por captura de tela. Restaurar pelo botão retornou a prévia ao segundo bloco e ao estado ao vivo. Esses ensaios utilizaram janelas no mesmo computador; não comprovam funcionamento de um datashow.

Foi salva uma edição do segundo bloco com texto diferente. A preparação exibiu o texto novo, enquanto a prévia manteve o original da sessão. O texto original também foi confirmado na árvore de acessibilidade da saída enquanto a camada preta estava ativa. Isso verifica a separação entre conteúdo preparado e sessão ao vivo; uma captura preta isolada não verificaria o texto subjacente.

O ensaio encontrou um travamento após abrir a saída e mudar o foco; a implementação foi ajustada para não manter o mutex do estado da saída durante chamadas nativas de janela. Após o ajuste, a interface voltou a responder e os ensaios de projeção acima foram realizados. Correções adicionais de concorrência no cache de músicas e na operação da saída passaram em `cargo check` e na revalidação final de build, testes e Clippy.

O aplicativo gerado pelo build final foi aberto novamente por automação da interface nativa. A edição salva estava persistida; abrir a saída manteve o foco no operador; apresentar o primeiro bloco e apagar a saída funcionaram. O fluxo manual completo, arraste nativo do repertório, escolha de monitor e ensaios prolongados ainda estão pendentes. Nenhum teste em projetor físico, Windows ou Linux foi registrado.

## Verificações automatizadas

- [x] Separação de letras: acentos, CRLF, linhas em branco e blocos vazios.
- [x] Reordenação: música repetida preserva identidade de cada item.
- [x] Navegação: limites da música, apagar e restaurar.
- [x] Snapshots fora de ordem e revisões repetidas são ignorados.
- [x] Migração de banco, reabertura e persistência.
- [x] Edição da origem não altera a cópia ao vivo no teste do domínio.
- [ ] Exclusão da origem com saída real aberta.
- [x] TypeScript estrito e compilação Rust no macOS.

## Ensaio manual no aplicativo

Use letras de teste próprias. Registre se a saída era apenas uma janela, um monitor externo ou um projetor físico.

1. Cadastrar música com título, artista opcional, estrofe e refrão. Salvar e reiniciar o aplicativo. Confirmar todos os dados.
2. Buscar com variação de maiúsculas e acentos. Selecionar outra música sem alterar a saída.
3. Incluir uma música duas vezes no repertório. Reordenar por alça, teclado e botões. Cancelar um arraste com Escape. Reiniciar e conferir a ordem.
4. Abrir a projeção. Conferir saída preta inicial e ausência de segunda janela duplicada ao clicar novamente em abrir.
5. Projetar estrofe, refrão e voltar diretamente. Conferir texto, quebras de linha e margens na saída.
6. Editar outra música e salvar. Conferir que o conteúdo ao vivo não mudou. Repetir com edição da música de origem.
7. Apagar e restaurar. Verificar que a restauração mantém o bloco correto. No último bloco, avançar não deve trocar de música.
8. Digitar setas e atalhos em campos e diálogos. Confirmar que não operam a apresentação.
9. Fechar somente a projeção e reabri-la. Confirmar recuperação do estado, incluindo saída apagada.
10. Excluir uma música referenciada. Conferir aviso de impacto e resultado após confirmação; a cópia ao vivo deve permanecer.
11. Redimensionar as duas janelas e experimentar um bloco longo. Confirmar ausência de cortes silenciosos e aviso quando exigir divisão.
12. Se mídia estiver implementada, importar imagem e vídeo reais; confirmar loop sem áudio e ausência de reinício do vídeo em cada bloco. Testar arquivo inválido e falha de reprodução.

## Monitores e sistemas

| Ambiente | Build | Interface nativa | Monitor externo | Desconexão | Mídia real |
| --- | --- | --- | --- | --- | --- |
| macOS | v0.5.1: debug local, DMG arm64 assinado/notarizado e checks CI aprovados | Parcial; ver registros por versão | Pendente | Pendente | Não implementada |
| Windows | v0.5.1: checks/testes CI e instalador NSIS x64 aprovados; integridade conferida | Pendente | Pendente | Pendente | Pendente |
| Linux X11 | v0.5.1: checks/testes em runner Ubuntu; sem ensaio X11 | Pendente | Pendente | Pendente | Pendente |
| Linux Wayland | v0.5.1: checks/testes em runner Ubuntu; sem ensaio Wayland | Pendente | Pendente | Pendente | Pendente |

Teste escolha de saída, coordenadas negativas, DPI diferente, entrada/saída de tela cheia e reconexão. Ao desconectar a saída, a sessão deve permanecer e o operador deve conseguir escolher outro destino sem perder os controles. Sem hardware disponível, mantenha esses itens pendentes.

## Biblioteca e intercâmbio — incremento seguinte

A inspeção estrutural do pacote local `hc_xml.zip` confirmou 640 documentos OpenLyrics 0.8, sem extrair arquivos para o projeto. Os detalhes e fontes de compatibilidade estão em [Importação e exportação](import-export.md). Essa inspeção não equivale à execução do importador do LouvaShow.

Na revalidação deste incremento passaram 23 testes Rust com o catálogo local, 10 testes frontend e Clippy. Os testes cobriram importação transacional, repetição do pacote sem duplicação e exportação/reimportação real dos formatos JSON e OpenLyrics. Na interface nativa, foi observado o acervo com 641 músicas — 640 hinos mais a demonstração preexistente — e a prévia do seletor de arquivos com os 640 XMLs. O diálogo nativo de salvar a exportação ainda não foi validado manualmente.

Os dois testes dependentes do acervo privado usam a feature `bundled-hymns`. O código público mantém essa feature desabilitada por padrão; os resultados com acervo privado não implicam que esse arquivo esteja publicado.

- [ ] Importar o pacote local: prévia com 640 músicas e confirmação com contagens corretas.
- [x] Reimportar o mesmo pacote sem duplicar as músicas já importadas — teste automatizado.
- [x] Falha em uma música do lote reverte toda a gravação — teste automatizado.
- [ ] Verificar quebras `br`, acentos, copyright e partes com sufixos (`v1a`, `c1b`).
- [ ] Verificar `verseOrder` com repetição em fixture sintética e referência inválida com mensagem útil.
- [ ] Rejeitar DTD, entidade externa, ZIP excessivo, entrada não suportada e XML malformado sem escrever arquivos externos.
- [ ] Classificar lote, criar classificação e confirmar persistência após reinício.
- [ ] Excluir seleção/toda a biblioteca com impacto correto no repertório, sem alterar a cópia ao vivo.
- [x] Gerar e reimportar JSON LouvaShow e ZIP OpenLyrics — teste automatizado com catálogo real.
- [ ] Salvar a exportação pelo diálogo nativo e conferir o arquivo no destino escolhido.
- [ ] Testar XML exportado no OpenLP real. A aderência ao formato não substitui esse teste.
- [x] Confirmar preservação de categorias e metadados no roundtrip JSON — teste automatizado.

Formatos próprios do Holyrics e Super Cânticos permanecem sem compatibilidade validada. O hinário local não foi autorizado por esta documentação para incorporação em pacotes públicos.

## Ajuste de rolagem do operador — 2026-10-29

Build TypeScript/Vite e bundle macOS debug concluídos. No aplicativo nativo, a música com cinco blocos foi rolada até o último bloco: prévia da saída, biblioteca e barra de operação permaneceram na mesma posição. Repertório e temas usam uma área de rolagem própria abaixo da prévia.

## Pacote local v0.2.0 — macOS arm64

O aplicativo `.app` e o DMG locais receberam status **Accepted** no serviço de notarização da Apple. Os tickets anexados foram validados com `stapler`, e o Gatekeeper aceitou os artefatos. O DMG foi montado e os hashes dos arquivos de runtime foram comparados com o aplicativo de origem.

Esses resultados verificam assinatura, notarização e integridade do pacote. A instalação e a execução da versão release produzida ainda não foram testadas; os ensaios de interface registrados anteriormente utilizaram o aplicativo debug. Não houve teste deste pacote em Windows, Linux ou datashow físico.

O arquivo de código-fonte destinado à publicação foi preparado sem `hc_xml.zip`. Em uma cópia limpa, sem esse pacote privado, passaram `npm run build`, os 10 testes frontend e `cargo test --locked --no-default-features`. O DMG entregue também passou em nova conferência SHA-256, `stapler validate`, `hdiutil verify` e avaliação do Gatekeeper.

A matriz de integração contínua da versão 0.2.0 também concluiu com sucesso. Esse resultado confirma os checks configurados no workflow; não comprova uso da interface, monitores, instalação ou operação ao vivo em cada sistema.

## Repertórios por evento — v0.3.0

A revisão estática conferiu identificação explícita do repertório nas mutações, validação de pertencimento dos itens, persistência da seleção, fallback transacional após exclusão e preservação da biblioteca e do coordenador de apresentação. As permissões de criar, selecionar, renomear e excluir repertórios pertencem somente à janela do operador. A exportação continua limitada às músicas.

Passaram 26 testes Rust na configuração pública, 28 com o hinário local e 13 testes frontend, além de formatação Rust e Clippy. A suíte inclui isolamento entre listas, rejeição de itens de outra lista, persistência após reabertura, seleção de fallback, exclusão preservando músicas/snapshot, normalização das listas afetadas e validação de nomes.

O ensaio nativo no macOS utilizou um identificador de aplicativo isolado e dados demonstrativos, sem acessar a biblioteca real do usuário. Foram criados dois repertórios de eventos, com duas ocorrências da demonstração no primeiro e uma no segundo. Criar, alternar e renomear as listas manteve a prévia no bloco Abertura, 1/3, ao vivo. O nome com acentos foi inserido por colagem. O botão de mover para baixo alterou a ordem dos itens, conferida na árvore de acessibilidade. Fechar e reabrir o aplicativo recuperou a seleção do primeiro repertório com seus dois itens. Uma captura de tela confirmou o layout.

A exclusão de repertórios não foi acionada nesse ensaio nativo; sua cobertura neste incremento é automatizada. O ensaio de reabertura confirmou a seleção e a quantidade de itens, sem uma conferência independente da ordem após o reinício.

- [x] Criar dois repertórios por evento, adicionar músicas repetidas e conferir isolamento ao alternar.
- [x] Renomear com acentos; reabrir o aplicativo e conferir seleção e quantidade de itens persistidas.
- [x] Mover um item pelo botão para baixo e conferir a mudança na interface.
- [ ] Conferir a ordem após reiniciar; reordenar por teclado e arraste sem alterar outro repertório.
- [ ] Excluir o repertório ativo; conferir fallback, biblioteca preservada e saída ao vivo inalterada.
- [ ] Conferir bloqueio da exclusão do último repertório.
- [ ] Testar erros recuperáveis no diálogo e atalhos de apresentação inativos durante a edição.

Esses resultados não representam testes em datashow, Windows ou Linux.

### Créditos e comunidade

A revisão estática confirmou que o comando para abrir a comunidade aceita apenas a janela do operador e utiliza um endereço HTTPS fixo. A interface não pode fornecer uma URL ou aplicativo arbitrário. A projeção não recebeu essa permissão, e a abertura automática de links pelo plugin está desabilitada. O acesso externo ocorre somente pelo botão explícito; a biblioteca e a apresentação continuam locais.

No ensaio nativo, o botão do cabeçalho abriu o diálogo, confirmado visualmente. Acionar “Abrir grupo no WhatsApp” retornou a mensagem de convite enviado e abriu no navegador a URL pública esperada, com a identificação do LouvaShow e o convite para conversa em grupo. Não houve entrada no grupo nem envio de mensagem; a aba de teste foi fechada.

## Navegação e painéis — v0.4.0

A terminologia visível foi unificada como “repertório”, preservando os identificadores e contratos internos existentes. Após essa alteração, passaram os cinco testes Rust focados em repertórios, incluindo isolamento, persistência e preservação da apresentação. Esse resultado não valida o novo layout.

A suíte completa Rust com o hinário local passou com 28 testes, assim como Clippy. Passaram também 25 testes frontend, incluindo 12 novos testes de layout. Na revisão estática, navegar entre contextos não envia comandos de apresentação, os blocos de Músicas são somente leitura e os separadores de painéis estão excluídos dos atalhos ao vivo. A revisão conferiu validação das preferências, limites de largura, cancelamento de arraste e ocultação com `hidden`/`inert`.

O ensaio nativo no macOS utilizou dados isolados e uma demonstração com três blocos. Após apresentar Abertura, 1/3, a seta direita no separador alterou a biblioteca de 260 para 276 pixels sem avançar a apresentação. Enter recolheu e reabriu o painel. Repertórios manteve sua largura própria de 260 pixels, enquanto Operação ao vivo preservou 276 pixels. Foi adicionada uma ocorrência da música ao repertório.

O arraste com mouse alterou a biblioteca de 260 para 336 pixels; arrastar até a zona de recolhimento ocultou o painel, e Mostrar o reabriu com 336 pixels. Navegar por Configurações e Músicas preservou a prévia em Abertura, 1/3. Uma alteração de fonte de 64 para 80, ainda sem aplicar, permaneceu no formulário após navegar para Músicas e voltar a Configurações. A árvore de acessibilidade confirmou os blocos de Músicas como conteúdo de leitura, sem ação de projetar. Reiniciar o aplicativo recuperou a largura de 276 pixels em Operação ao vivo. Capturas em 1360 × 860 confirmaram o layout.

No ensaio final em 760 × 600, a biblioteca foi recolhida automaticamente para preservar a prévia à direita. Mostrar Biblioteca reabriu o painel esquerdo com 276 pixels e recolheu o direito. Após selecionar a demonstração, Mostrar Saída reabriu o painel direito com 340 pixels, preservando a música em preparação. A captura após o ajuste de CSS para janelas baixas confirmou a prévia e a legenda integrais, os controles acessíveis e a ausência de transbordamento horizontal. Rolar o repertório até a música de demonstração mostrou o item completo, mantendo a prévia na mesma posição e o quadro 16:9 sem cortes.

O roteiro distingue o que foi observado dos ensaios ainda pendentes:

- [x] Alternar entre operação ao vivo, repertórios, músicas e configurações sem comandar a projeção nem perder a preparação.
- [x] Redimensionar o painel da biblioteca por arraste e teclado, mantendo o bloco ao vivo.
- [x] Recolher e reabrir o painel por Enter, arraste até a borda e botão Mostrar.
- [x] Reiniciar o aplicativo e conferir a recuperação da largura salva para Operação ao vivo.
- [x] Conferir o layout em 1360 × 860 e apresentar uma demonstração em janela separada.
- [ ] Cancelar o redimensionamento com Escape ou cancelamento do ponteiro na interface nativa; conferir ausência de persistência.
- [ ] Conferir por navegação com Tab que controles recolhidos não recebem foco.
- [ ] Usar preferências malformadas no aplicativo nativo e verificar recuperação segura para valores válidos.
- [x] Reduzir a janela para 760 × 600; conferir controles legíveis, rolagem independente e acesso aos painéis sem sobreposição.

Os resultados das versões anteriores não comprovam o comportamento visual desta reorganização. Testes em outros sistemas e em monitor externo continuam dependendo de ensaios próprios.

## Pacote local v0.3.0 — macOS arm64

Aplicativo e DMG receberam **Accepted** na notarização da Apple. Assinaturas, tickets anexados e Gatekeeper foram verificados; o DMG passou na conferência de integridade e foi montado para comparar os hashes de todos os arquivos de runtime. O pacote contém somente o aplicativo e o atalho de instalação. O hinário opcional permanece restrito ao build local, fora do GitHub.

O ensaio de interface acima utilizou o build debug isolado. A instalação e execução deste pacote release, Windows, Linux e datashow físico continuam sem validação manual registrada.

## Pacote local v0.4.0 — macOS arm64

Aplicativo e DMG receberam **Accepted** na notarização da Apple. Os tickets foram anexados e validados; assinatura, Gatekeeper e integridade do DMG passaram. A imagem foi montada em modo somente leitura, e todos os arquivos de runtime corresponderam por SHA-256 ao aplicativo validado. O pacote contém somente o aplicativo e o atalho para Applications. Certificados, configurações privadas e documentação de desenvolvimento não integram o instalador.

Uma consulta ao Keychain falhou temporariamente após o envio do aplicativo. A consulta seguinte confirmou Accepted; o empacotamento retomou essa submissão, sem reenviar o aplicativo. O hinário opcional permanece no build local, fora do código público.

Os ensaios de interface desta versão usaram o aplicativo debug com dados isolados. A instalação e execução do pacote release, o uso em projetor físico e os testes nativos em Windows e Linux permanecem pendentes.

## Bíblia offline — v0.5.0

O catálogo contém quatro edições em português, com 240 arquivos de livros. A BLT contém somente o Novo Testamento; a BPM é identificada como rascunho. Foram conferidos 108.178 textos contra os arquivos VPL XML fixados por SHA-256. As licenças, omissões de registros vazios e candidatas não incorporadas estão em [Fontes bíblicas](bible-sources.md). Essa conferência preserva a fonte recebida; não constitui revisão editorial ou teológica das traduções.

Passaram 33 testes Rust sem o hinário privado, 35 com ele, Clippy, formatação Rust, build TypeScript/Vite e 31 testes frontend. A cobertura inclui todos os livros e capítulos incorporados, identificadores e limites inválidos, intervalos de versículos, paginação sem perda de bytes, navegação limitada à sequência apresentada, troca música/Bíblia, falha atômica, serialização, snapshots fora de ordem e descarte de respostas antigas da consulta.

A revisão independente conferiu os comandos restritos ao operador, o manifesto de recursos sem travessia de caminhos ou links simbólicos, o cache por livro e a ausência de acesso ao catálogo pela projeção. Os créditos completos permanecem no operador; o slide mostra referência e sigla. A distribuição inclui os avisos legais como recurso próprio.

No aplicativo nativo de teste com dados isolados, em 1360 × 860, o filtro `joao` encontrou João sem exigir acento. Escolher João 3 e preparar o versículo 16 manteve a saída fechada. Abrir a projeção iniciou a saída apagada; o comando explícito apresentou João 3:16, com texto, referência e sigla conferidos na prévia. Próximo avançou para 3:17 e a seta esquerda retornou a 3:16. Consultar João 4 preservou 3:16 na sessão. Apagar e restaurar pelo botão/atalho preservou a passagem.

O seletor nativo mostrou as quatro edições, incluindo os rótulos de rascunho e Novo Testamento. A tentativa de acioná-lo por automação de acessibilidade teve timeout, e a sessão foi reiniciada; não foi registrada uma troca de versão concluída por esse ensaio. A verificação dos dados de todas as versões foi automatizada. A janela de teste também recebeu interações externas durante a continuação, portanto essas mudanças não foram contabilizadas como resultados do roteiro.

No ensaio isolado em 760 × 600, foi selecionado Ester 8:9. O texto extenso foi dividido em duas páginas; Próximo levou da parte 1/2 à parte 2/2. A janela real de projeção mostrou a segunda parte, a referência e a sigla BLIVRE. Fechar a projeção informou “Desconectada”, preservando a página 11/21 da sessão; reabrir recuperou essa mesma parte. A rolagem central e os painéis recolhíveis mantiveram os controles acessíveis. O ensaio usou duas janelas no mesmo monitor.

Em uma tentativa posterior, a troca de BLIVRE para ONBV foi concluída por teclado no seletor nativo, e a lista de 66 livros e os créditos de ONBV foram atualizados. Interações externas subsequentes na janela não foram contabilizadas como passos do ensaio.

## Prévia de edição, aparência e marca — v0.5.0

A revalidação passou com 37 testes Rust públicos, 39 com o hinário local, Clippy, formatação Rust e 42 testes frontend. O bundle macOS debug isolado compilou com as logos coloridas, os novos selects e os dois modos de aparência. A revisão independente conferiu limites da caixa, fonte mínima, rascunho separado, erros recuperáveis, persistência retrocompatível e isolamento da aparência do operador.

No ensaio nativo, a demonstração foi projetada no bloco Abertura. Alterar a fonte de 64 para 90 atualizou imediatamente a prévia de edição, mantendo a prévia ao vivo original. Clicar na caixa revelou oito alças; duas operações Shift+seta esquerda na borda direita mudaram a largura de 86% para 76%. Arrastar a mesma borda reduziu-a para 61,89%, com atualização da prévia e sem avançar a sessão. Os selects de classificação, repertório, monitor e fonte foram conferidos visualmente com altura e seta próprias do tema escuro.

Interações externas posteriores mudaram a janela para o modo claro e abriram os créditos. Uma captura confirmou logo colorida, diálogo claro e controles legíveis; a sequência de alternância, aplicação do tema e reinício não foi contabilizada como ensaio controlado. Cancelamento de arraste nativo, persistência da aparência após reinício e teste manual de aplicação com falha permanecem pendentes; os comportamentos correspondentes têm validação de código e testes de domínio.

O ícone oficial foi convertido pela CLI do Tauri para ICNS, ICO e PNG. Os PNGs de marca preservam os dados de pixels originais; metadados não necessários foram excluídos. O aplicativo debug observado ainda antecede a troca final do ícone do bundle.

## Interface compacta e modos da Bíblia — v0.5.1

Passaram 49 testes frontend e o build TypeScript/Vite. A revisão independente conferiu a separação entre preparar e projetar, a referência preservada entre versões e as grades de tamanho fixo. Um conflito de especificidade que anulava a redução do cabeçalho foi corrigido; as regras finais de 56px/88px foram conferidas no CSS compilado.

No aplicativo nativo isolado em 1360 × 860, abrir a saída iniciou a prévia apagada. Selecionar Gênesis 1:1 no modo Preparar não apresentou conteúdo; o botão Projetar enviou o texto. Selecionar 1:2 manteve 1:1 na prévia ao vivo. Ativar Projetar ao clicar também preservou a sessão; clicar em 1:3 atualizou a prévia imediatamente. Capturas confirmaram quadrados uniformes, indicação verde sem texto adicional dentro do botão e versões no topo.

Trocar BLIVRE por ONBV preservou Gênesis 1:3 e carregou o texto correspondente na consulta, mantendo BLIVRE na saída. Trocar para BLT informou livro indisponível, preservando o nome Gênesis e a sessão. Voltar a BLIVRE recuperou capítulo 1 e versículo 3. O diálogo de créditos foi conferido com logo final, retrato do autor e opções de apoio. O ensaio antecede apenas a correção final de altura do cabeçalho; essa correção recebeu verificação de build/CSS. Não houve teste em projetor físico nem operação nativa em Windows ou Linux.

Na continuação do ensaio, alternar Escuro para Claro preservou Gênesis 1:3 e as cores do slide ao vivo. Reiniciar o aplicativo isolado recuperou a aparência clara. O bundle debug reconstruído com a altura final do cabeçalho foi observado em 760 × 600: navegação em duas linhas, painéis recolhíveis, grade acessível por rolagem central e barra de operação fixa. O modo da Bíblia voltou a Preparar, conforme o padrão de cada sessão.

### Pacotes macOS v0.5.1

O aplicativo e o DMG públicos, sem hinário privado, receberam **Accepted** na notarização da Apple. Assinaturas, tickets anexados, Gatekeeper e integridade foram verificados. A leitura do DMG montado confirmou por SHA-256 todos os arquivos de runtime: executável, Info.plist, ícone e avisos legais da Bíblia. Uma distribuição separada com o catálogo local também foi assinada, notarizada e conferida; ela não é enviada ao GitHub. A execução do instalador release e o ensaio de instalação permanecem distintos dos testes nativos feitos com o bundle debug isolado.

### Integração contínua v0.5.1

O [run de checks 40983714675](https://github.com/dantetesta/LouvaShow/actions/runs/40983714675) concluiu com sucesso em macOS, Windows e Ubuntu. Em cada sistema passaram 49 testes frontend e 37 testes Rust públicos, além do build TypeScript/Vite e da auditoria dos arquivos públicos. Os runners não executaram ensaio visual, instalação nem teste de monitores.

O instalador NSIS x64 foi obtido do artifact `installer-windows-x64` do run 40983714897. A listagem e o teste de integridade com 7-Zip passaram: nove entradas, compostas pelo executável, avisos legais, desinstalador, componentes do NSIS e instalador offline do WebView2. Não foram encontrados bancos pessoais, certificados, documentação interna nem fontes de desenvolvimento na lista do pacote. O EXE não foi executado no macOS; instalação e operação nativa em Windows continuam pendentes.

Os dois jobs de instaladores do [run 40983714897](https://github.com/dantetesta/LouvaShow/actions/runs/40983714897) concluíram com sucesso. O DMG produzido no CI é substituído na release pelo DMG público notarizado localmente; seu hash final é diferente do artifact não notarizado do CI. A versão local com hinário permanece fora da release.

## Introdução e recuperação de carga — desenvolvimento 0.6.0

No aplicativo debug isolado do macOS, a janela de abertura foi observada em 640 × 360: vídeo, autoria, versão e barra fina apareceram; ao concluir a abertura, o operador recebeu foco. O MP4 distribuído foi conferido com ffprobe: uma única faixa H.264, 1280 × 720, 10 segundos e nenhuma faixa de áudio.

Para ensaiar falha real sem usar o banco do usuário, o banco do identificador QA foi preservado por renomeação e substituído temporariamente por um diretório vazio. A janela informou que não conseguiu abrir o banco e ofereceu Tentar novamente. Após restaurar o arquivo original intacto, o botão retomou a inicialização e abriu o operador. Não houve reset ou perda do banco. A sequência foi observada pela interface nativa.

## Cifras e equipe — validação integrada 0.6.0

No bundle debug isolado do macOS, foi criada uma cifra a partir da demonstração própria. Um acorde D/F# foi inserido e transposto em dois passos de meio tom para E/G#, com tom real E. Salvar criou revisão 1. O viewer abriu dois painéis independentes; subir meio tom somente no segundo mostrou F/A e tom F, preservando E/G# e tom E no primeiro. A captura encontrou a barra do operador ainda aparecendo no modo palco; a correção usa um portal fora do isolamento do workspace e exige o smoke final do bundle reconstruído.

O servidor foi iniciado explicitamente somente em 127.0.0.1, com perfil e e-mail sintéticos. O navegador mostrou o código de pareamento correspondente ao operador, que aprovou o dispositivo. Recarregar a página manteve a sessão. A cifra pessoal do operador não apareceu para o músico; depois de publicar uma cópia para a igreja e recarregar a biblioteca, ela apareceu com Abrir/Duplicar, sem editar/excluir a versão alheia. Criar o repertório pessoal Ensaio QA e adicionar a cifra fixou revisão 1. A cifra foi aberta e conferida visualmente no Chrome. Encerrar o aplicativo fechou a porta 14210, conferida por conexão recusada. Esse ensaio usa o mesmo computador/loopback; não comprova Wi-Fi ou outro dispositivo físico.

A revisão também identificou Atualizar da área web sem renovar a lista de cifras da música já selecionada; o frontend recebeu a correção antes do smoke final. Não foram feitas chamadas reais à Groq, gravação de voz, consulta Gravatar com dados pessoais ou gravação de chave no cofre. Esses recursos exigem configuração explícita do usuário e ensaios próprios.

### Verificações focadas e limites da entrega 0.6.0

Passaram seis testes Rust do serviço de equipe: cookie protegido e pareamento pelo roteador HTTP, aprovação/revogação, isolamento de repertórios e revisão CAS, Host/Origin/CSRF, recusa de operações após desligar o serviço, migração/persistência e aprovação mantida até revogação com expiração somente dos pedidos pendentes. Passaram quatro testes do assistente: recursos desligados por padrão, validação de assinatura/extensão do áudio e divisões que preservam o texto original, inclusive parágrafo único, acentos e espaços. Clippy em todos os targets locais passou com avisos tratados como erro. Esses testes de roteador/domínio não comprovam uso por um aparelho externo.

O destino do instalador Windows é Windows 10/11 x64, e os builds macOS são separados entre Apple Silicon e Intel. Não há execução nativa registrada de 0.6.0 em Windows, Mac Intel ou Linux. O ensaio Apple Silicon acima é parcial e não equivale a um ensaio de instalação dos três pacotes finais. Build, assinatura e notarização devem ser registrados somente quando concluídos para cada artefato.

Permanecem sem ensaio real: chamada à Groq com chave válida, cofre em cada sistema, gravação de microfone, Gravatar externo, rede entre aparelhos físicos, segundo monitor e projetor. Navegadores exigem contexto seguro para microfone; o HTTP da LAN não oferece essa garantia. A importação Cifra Club pode receber HTTP 403 ou conteúdo incompatível e não contorna bloqueios.

### Gate local 0.6.0

- 74 testes frontend e 70 testes Rust públicos passaram; formatação e Clippy com `-D warnings` passaram.
- Reinício do bundle isolado macOS Apple Silicon confirmou versão 0.6.0, vídeo de abertura, persistência da cifra e servidor desligado. Modo palco cobriu toda a área da aplicação, sem a barra de operação por cima.
- Navegador de teste retomou dispositivo aprovado e repertório pessoal salvo depois do reinício. Os ajustes finais de editor e isolamento de notas possuem testes automatizados; não equivalem a teste de instalação em outros sistemas.

### Fechamento da distribuição 0.6.1

- A revisão final independente confirmou bloqueio de edição durante operações, visibilidade fixa nas cifras existentes, proveniência ao duplicar e notas separadas por perfil.
- No bundle isolado Apple Silicon, o seletor nativo de exportação ChordPro abriu e o cancelamento retornou ao editor. A sugestão capo 2 converteu E/G# em D/F#, mantendo o tom declarado E; a nova revisão foi salva. O repertório pessoal no navegador continuou exibindo a revisão 1, com capo 0, mesmo com a biblioteca na revisão 2.
- Repertório com duas ocorrências da mesma cifra: próximo chegou a 2/2 e foi desabilitado; anterior voltou a 1/2. Sessão aprovada persistiu após reiniciar o aplicativo. O servidor começou desligado e foi encerrado ao final do teste.
- 72 testes Rust com a feature privada de hinário passaram localmente, incluindo o pacote de 640 hinos. Esse pacote não integra o Git ou a distribuição pública.
- DMGs públicos 0.6.1 arm64 e x86_64 e o DMG local privado arm64 foram assinados, aceitos pela notarização Apple, receberam os tickets e passaram Gatekeeper, integridade e leitura dos arquivos internos. Assinatura/notarização não comprovam execução em hardware Intel.

- GitHub Actions da tag `v0.6.1`: [verificações de código](https://github.com/dantetesta/LouvaShow/actions/runs/40994317979) passaram em Windows, macOS e Ubuntu. No Windows, o harness iniciou e completou 70 testes Rust; 74 testes frontend também passaram. O erro de carregamento de 0.6.0 foi resolvido pelo manifesto v6. O job Windows 2022 dos instaladores manteve testes e Clippy e passou essa etapa.

- [Instaladores da tag v0.6.1](https://github.com/dantetesta/LouvaShow/actions/runs/40994317942): três targets concluídos com sucesso. Windows 2022 confirmou 74 testes frontend, 70 Rust e Clippy; NSIS com WebView2 offline gerado. Isso comprova o build e a execução das suítes no runner, sem afirmar instalação ou operação em Windows 10/11 de uso final.

- EXE final inspecionado com 7zz: NSIS íntegro, nove arquivos de instalação/runtime, incluindo WebView2 offline e avisos bíblicos. Executável PE x86_64 com manifesto Common Controls v6 confirmado. Verificação dos padrões de segredo e ausência do pacote privado de hinos passou.
- [Release pública 0.6.1](https://github.com/dantetesta/LouvaShow/releases/tag/v0.6.1) publicada com três instaladores e SHA256SUMS.txt. Os dois DMGs do CI foram substituídos pelos builds locais públicos assinados/notarizados. Hashes locais e digests dos quatro assets remotos conferidos.
