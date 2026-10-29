# Importação, exportação e compatibilidade

## Contrato escolhido

O intercâmbio entre LouvaShow e outras ferramentas usa OpenLyrics XML. O JSON versionado do LouvaShow preserva os campos próprios da biblioteca. Um ZIP de XMLs reúne arquivos para transporte; não é um novo dialeto de XML nem uma garantia de que outro programa importe ZIP diretamente.

Uma extensão `.xml`, `.json` ou `.txt` sozinha não identifica o formato interno. O importador precisa validar o conteúdo e informar limitações na prévia. Compatibilidade de formato exige teste de ida e volta; documentação de terceiros, isoladamente, não comprova o comportamento do LouvaShow.

## Formatos locais

**TXT UTF-8:** a primeira linha é o título; as linhas seguintes são a letra. Linhas em branco separam os blocos. Autoria, copyright e classificação não são inferidos do texto. Um arquivo representa uma música.

**JSON LouvaShow v1:** o envelope contém `format: "LouvaShow"`, `schemaVersion: 1` e `songs`. Cada música tem `title`, `artist`, `copyright`, `categoryName` e `blocks`; cada bloco contém `label` e `text`. IDs locais e posições de banco não são importados como identidades externas. Um JSON genérico de outro programa não é automaticamente compatível com esse contrato.

**OpenLyrics 0.8:** XML por música, exportável em ZIP. Rótulos livres dos blocos são convertidos em nomes válidos de versos; use JSON para preservar o rótulo exato. Outros metadados OpenLyrics, como traduções paralelas, cifras e ordem opcional de partes, não têm promessa de roundtrip integral nesta versão.

Ao importar, confira a prévia, avisos e classificação antes de confirmar. A deduplicação acompanha o conteúdo anteriormente importado; ela não é uma busca universal de equivalência entre todas as músicas criadas manualmente. O conteúdo já ao vivo não muda após importar, classificar ou excluir músicas.

O limite de entrada é 10 MiB por lote, com até 5.000 arquivos/músicas. XML e TXT individuais, assim como cada entrada de ZIP, têm limite de 1 MiB; o conteúdo descompactado total tem limite de 24 MiB. Um JSON LouvaShow avulso pode usar o limite total de 10 MiB. Divida seleções maiores em lotes. Cada música deve ter de 1 a 500 blocos e cada bloco, no máximo 32.000 bytes de texto.

## O que foi verificado nas fontes oficiais

| Aplicativo/formato | Evidência | Decisão para o LouvaShow |
| --- | --- | --- |
| OpenLP | O manual descreve importação e exportação OpenLyrics, com um XML por música. | Priorizar OpenLyrics 0.8. Para importar o ZIP exportado no OpenLP, extraia os XMLs e selecione-os no importador. O fluxo direto de ZIP não foi confirmado. |
| Holyrics | O histórico oficial menciona músicas `.muf`/`.mufl` e importação `.txt` e `.scct` (denominado “Super Songs”). | Não tratar arquivos próprios do Holyrics como OpenLyrics. Um TXT simples pode ser revisto e importado como texto; não prometer preservação dos metadados proprietários. |
| Super Cânticos | Não foi encontrada especificação primária suficiente do formato. A menção a `.scct` no Holyrics não documenta seu schema. | Suporte específico fica pendente de documentação ou amostra autorizada. Não inferir compatibilidade pela extensão. |

Fontes: [OpenLP — importação](https://manual.openlp.org/songs.html), [OpenLP — exportação](https://manual.openlp.org/export_songs.html), [Holyrics — changelog](https://www.holyrics.com.br/changelog/).

## Subconjunto OpenLyrics

O alvo inicial é `version="0.8"` com namespace `http://openlyrics.info/namespace/2009/song`, em UTF-8. Cada XML representa uma música; propriedades não dependem da ordem dos elementos. O título vem de `properties/titles/title`, autoria de `authors`, copyright de `copyright`, os blocos de `lyrics/verse` e as quebras de linha de `br` dentro de `lines`.

`verseOrder`, quando presente, contém referências separadas por espaços e admite repetição. Sufixos como `v1a` e `c1b` não devem ser truncados. Na ausência de ordem explícita, conservar a sequência dos versos é uma política do importador; não inventar repetições de refrão. Comentários e cifras não devem aparecer inadvertidamente como letra destinada à congregação.

A exportação deve escapar caracteres XML, usar nomes de versos válidos e únicos, informar a ordem e omitir elementos vazios. O formato próprio JSON é a referência para preservar campos que não têm correspondência exata no subconjunto OpenLyrics. Fonte fixada: [especificação no tag OpenLyrics v0.8](https://raw.githubusercontent.com/openlyrics/openlyrics/v0.8/docs/source/dataformat.rst).

## Pacote local inspecionado

O arquivo fornecido `hc_xml.zip` foi inspecionado sem extrair seus XMLs para o projeto. Uma cópia privada pode integrar o build local por meio da feature `bundled-hymns`; o arquivo não acompanha o código público e o build padrão não depende dele. Contém 640 XMLs OpenLyrics 0.8: 2.742 versos, 10.269 quebras `br`, nenhum `verseOrder`, nenhum DTD e copyright “Harpa Cristã” em todos os arquivos. Os hinos 151, 224 e 243 têm nomes de partes com sufixos alfabéticos. Os resultados de parser e banco estão no [registro de validação](validation.md).

O ZIP tem 567.008 bytes e os XMLs totalizam 860.525 bytes descompactados. SHA-256: `5a7c721896fec76b3f54fe5bb0f5369d3ffe121cc224aab0544fec268b3ba808`.

A importação local e a inclusão do hinário em uma distribuição pública são decisões diferentes. O pacote inicial foi solicitado para uso local; a publicação pública desse conteúdo permanece pendente da verificação dos direitos de redistribuição, assim como a licença do software. O metadado de copyright não é uma autorização. Testes públicos do parser podem utilizar exemplos sintéticos com os mesmos elementos estruturais, sem depender da redistribuição das letras do pacote local.

## Limites de segurança a validar

O parser deve processar ZIP sem extrair caminhos de entrada para o sistema de arquivos, limitar número de arquivos e bytes realmente lidos/descompactados e rejeitar XML com DTD/entidades externas. Rejeitar ou informar formatos, versões e referências de verso não suportados, sem importar silenciosamente um conteúdo diferente. As bibliotecas escolhidas oferecem controles relevantes: [roxmltree — ParsingOptions](https://docs.rs/roxmltree/latest/roxmltree/struct.ParsingOptions.html) e [zip — leitura](https://docs.rs/zip/latest/zip/read/struct.ZipArchive.html).

O sucesso de uma prévia não confirma gravação no banco. A confirmação deve executar uma transação, tratar duplicados explicitamente e apresentar contagem de importados e ignorados. Exclusão em lote deve mostrar o impacto no repertório; a sessão ao vivo permanece uma cópia independente.
