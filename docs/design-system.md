# Controles da interface

LouvaShow é um aplicativo de operação ao vivo. Campos e ações que pertencem à mesma linha usam a mesma altura, borda, raio e escala tipográfica. Rótulos ficam acima dos campos; a base dos controles fica alinhada. Não se acrescenta espaço vazio para simular um rótulo.

## Tokens

Definidos em `src/shared/styles/controls.css`, nos escopos do operador e dos formulários de cifras:

| Token | Desktop | Uso |
| --- | --- | --- |
| `--control-height` | 38 px | Formulários, ações principais e operação |
| `--control-height-dense` | 32 px | Toolbars secundárias, paginação e organização de partes |
| `--control-radius` | 6 px | Cantos de campos e botões da linha |
| `--control-border-width` | 1 px | Borda permanente, sem mudar no foco |
| `--control-padding-inline` | 10 px | Respiro horizontal; select reserva espaço para a seta |
| `--control-font-size` | 13 px | Texto dos controles agrupados |
| `--control-focus-width` | 1 px | Contorno de foco visível, afastamento de 1 px |

Em dispositivos cujo apontador principal é tátil (`pointer: coarse`), as duas alturas passam a 44 px. O tamanho denso deve ser aplicado à linha inteira por `--row-control-height`, nunca somente a um dos controles.

## Uso e estados

- As linhas de controle existentes estão explicitamente enumeradas no CSS: metadados de músicas e cifras, transposição, colagem/importação, filtros e classificação da biblioteca, repertórios, operação, temas, ajustes de bloco e configurações de provedores.
- Uma nova toolbar deve reutilizar uma classe apropriada ou ser incluída explicitamente nessa lista. Evite seletores globais de altura sobre todos os botões do aplicativo.
- Botões `Tom −½/+½` ficam em uma pequena grade com o rótulo acima, alinhados à base de Versão, Visibilidade, Tom declarado e Capotraste.
- `hover` usa as cores do tema; `focus-visible` usa contorno de 1 px, sem sombra grossa nem mudança de dimensões. `disabled` mantém a geometria, reduz a opacidade e impede o cursor de ação.
- Selects mantêm semântica e teclado nativos. O estilo da seta é responsabilidade do tema. Não use padding vertical fixo ou `!important` para tornar um select maior que os controles vizinhos.
- O seletor nativo de arquivos preserva a indicação do nome; somente seu botão recebe a escala visual comum. Inputs de arquivo ocultos permanecem ocultos.

## Exceções intencionais

Textarea, range, checkbox, radio, amostra de cor, listas múltiplas, alças de arraste/redimensionamento, cards de conteúdo, grade numérica da Bíblia, notas móveis e acordes editáveis têm geometria própria. Não recebem altura de campo textual.

O slide da congregação, a caixa de texto projetada e o leitor musical não recebem esses tokens de métricas por seletor de controle. Tamanho de letra, acordes e fundo continuam seguindo suas configurações próprias. As cores da interface permanecem nos temas Clássico, Claro e Escuro, sem alterar a projeção.

## Verificação

Confira pares de input/select/botão na mesma linha em uma janela desktop e em largura reduzida; foco por Tab, hover e disabled não devem deslocar o layout. Verifique Nova cifra, importação de documento, cadastro de música, gestor de classificações e barra de projeção. Build e testes de domínio não substituem essa conferência visual no WebView nativo.
