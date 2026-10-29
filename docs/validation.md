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
