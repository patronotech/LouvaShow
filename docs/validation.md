# Roteiro de validação

Este arquivo define os ensaios necessários. Uma caixa vazia significa que não há resultado registrado aqui; não significa aprovação. Registre sistema, versão, hardware, comando e resultado ao executar. Testes automatizados e build não substituem a observação da saída real.

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
| macOS | Debug local aprovado | Parcial; ver registro acima | Pendente | Pendente | Não implementada |
| Windows | Pendente | Pendente | Pendente | Pendente | Pendente |
| Linux X11 | Pendente | Pendente | Pendente | Pendente | Pendente |
| Linux Wayland | Pendente | Pendente | Pendente | Pendente | Pendente |

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
