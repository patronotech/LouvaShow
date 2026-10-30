# Fontes dos textos bíblicos offline

Pesquisa e preparação realizadas em 29/10/2026. O catálogo inicial incorpora **quatro edições em português: três com Antigo e Novo Testamento e uma somente com Novo Testamento**, com autorização de redistribuição declarada pela fonte. A meta aproximada de dez versões não justifica incluir traduções sem licença verificada, apresentar um Novo Testamento como Bíblia completa ou preencher a lista com outros idiomas.

## Catálogo incorporado

| ID | Edição e origem | Cobertura verificada no arquivo | Licença declarada |
| --- | --- | --- | --- |
| `blivre` | [Bíblia Livre, edição de fevereiro de 2018 — eBible `porbr2018`](https://ebible.org/details.php?id=porbr2018) | 66 livros, 1.189 capítulos, 31.102 versículos | CC BY 4.0; Diego Santos, Mario Sérgio e Marco Teles |
| `onbv` | [Biblica® Open Nova Bíblia Viva™ — eBible `poronbv`](https://ebible.org/details.php?id=poronbv) | 66 livros, 1.189 capítulos, 31.105 versículos | CC BY-SA 4.0; © 2007, 2010 Biblica, Inc. |
| `bpm` | [Bíblia Portuguesa Mundial — eBible `porbrbsl`](https://ebible.org/details.php?id=porbrbsl) | 81 livros/documentos, 1.402 capítulos, 38.029 versículos não vazios | Domínio público declarado pela fonte; **rascunho ainda em revisão** |
| `blt` | [Bíblia Livre Para Todos — eBible `porblt`](https://ebible.org/details.php?id=porblt) | **Somente Novo Testamento:** 27 livros, 260 capítulos, 7.942 versículos não vazios | CC BY-SA 4.0; © 2022 Free Bible Ministry, Inc. |

Os totais acima são contagens do material preparado, não uma tentativa de uniformizar cânones ou numerações. A BPM inclui os livros adicionais oferecidos pelo pacote, inclusive versões gregas de Ester e Daniel. Foram omitidos 29 registros sem texto da BPM e 17 da BLT; suas lacunas numéricas permanecem. Não foi criado texto para preenchê-las. Esses registros estão identificados nos avisos de terceiros. O nome e os créditos da BLT indicam sua cobertura exclusiva do Novo Testamento.

A [página do próprio projeto Bíblia Livre](https://blivre.org/) permite redistribuição integral, inclusive comercial. O aviso da edição eBible menciona “4.0 Brasil” em um trecho, mas também aponta expressamente para [CC BY 4.0 International](https://creativecommons.org/licenses/by/4.0/); o catálogo usa esse link canônico, preservando o aviso original no arquivo de terceiros. A edição deve continuar identificada como fevereiro de 2018, pois o projeto segue em revisão.

A ONBV também está disponível diretamente no [catálogo Open.Bible mantido pela Biblica](https://preview.open.bible/bibles/biblica-open-nova-biblia-viva-2007), com downloads USX e USFM e identificação CC BY-SA. Não é a NVI. O nome completo, os avisos de copyright e marca, a fonte original e a licença da conversão estão nos metadados offline. O texto convertido permanece sob CC BY-SA 4.0; isso não escolhe a licença do software LouvaShow.

## Outras seis candidatas examinadas

As linhas abaixo, somadas às quatro edições incorporadas, documentam dez candidatas pesquisadas. **Não são dez versões instaladas.**

| Candidata | Evidência primária e formatos | Situação neste incremento |
| --- | --- | --- |
| Tradução para Tradutores — TfTP | [eBible `portft`](https://ebible.org/details.php?id=portft), © 2018 Ellis W. Deibler, Jr., CC BY-SA 4.0; VPL, USFX e USFM. [Open.Bible identifica o pacote como Novo Testamento](https://open.bible/bibles/portuguese-ebible-text-nt/). | 27 livros confirmados, mas **não incorporada por erro na fonte**: Mateus 14:21 está dividido entre o registro 21 e um falso registro `000`, tanto no VPL quanto no USFM. Não corrigimos por inferência nem descartamos a continuação. Aguarda edição verificada. |
| Nova Versão de Acesso Livre — NVA | A [página oficial de leitura](https://www.biblianva.com.br/apenastextoptbr/gen/1/) declara CC BY-SA 4.0 e aponta a fonte no [Door43](https://git.door43.org/alexandre_brazil). | Boa candidata em português; falta fixar uma revisão do dataset, conferir os avisos dessa revisão e validar conversão/cobertura. Não confundir uma cópia ULB de outra data com a edição atual do site. |
| Almeida Revista e Corrigida histórica, reimpressão de 1911 | [Project Gutenberg nº 62383](https://www.gutenberg.org/ebooks/62383); HTML, TXT e EPUB. O [frontispício digitalizado](https://www.gutenberg.org/cache/epub/62383/pg62383-images.html) identifica primeira edição de 1900 e reimpressão de 1911. | O catálogo declara domínio público nos EUA e orienta verificar a situação nos demais países. Transcrição e separação de notas/versos ainda não auditadas; não incorporada. Não equivale à ARC moderna. |
| Almeida Recebida — AR | O [site do projeto](https://www.almeidarecebida.org/) declara domínio público e oferece MySQL v1.7. Porém a [página de download](https://www.almeidarecebida.org/download-portuguese-bible-almeida-recebida-xml/) também exibe aviso BY-NC-SA. | Declarações conflitantes na fonte primária. Não incorporada; esclarecer qual aviso rege o dataset antes de redistribuir. Não executar SQL obtido de terceiros. |
| Almeida Revista e Atualizada — ARA | A [página oficial de distribuição no YouVersion](https://www.bible.com/pt/versions/1608-ara-almeida-revista-e-atualizada) identifica a Sociedade Bíblica do Brasil e uma revisão moderna. | Não foi encontrada ali licença aberta de redistribuição integral. Leitura gratuita não autoriza embutimento. Não incorporada; depende de autorização aplicável. |
| Nova Versão Internacional — NVI | A [política da Biblica](https://www.biblica.com/permissions/) distingue citações limitadas de licenciamento da Bíblia completa e separa as edições abertas em Open.Bible. | A permissão de citar trechos não cobre um banco integral offline. Não incorporada; depende de licença específica. A exceção aberta confirmada neste catálogo é ONBV. |

Não se usam licenças MIT de repositórios agregadores como prova dos direitos sobre traduções. Para ampliar o catálogo, confira a edição, o titular, o arquivo efetivo, a abrangência da permissão e a atribuição exigida.

## Proveniência e transformação

Os arquivos originais vêm dos links VPL publicados nas páginas eBible acima:

| Edição | Download de desenvolvimento | SHA-256 do ZIP revisado |
| --- | --- | --- |
| BLIVRE | [porbr2018_vpl.zip](https://ebible.org/Scriptures/porbr2018_vpl.zip) | `1f71b7765795ae7cc416a9255c7d9c3a3932ce868206fa762606c7438c8fc682` |
| ONBV | [poronbv_vpl.zip](https://ebible.org/Scriptures/poronbv_vpl.zip) | `c63a702ba4b33ea0d4ff52048b5e488bf61b0fbc115f411d3a24731615cfc8db` |
| BPM | [porbrbsl_vpl.zip](https://ebible.org/Scriptures/porbrbsl_vpl.zip) | `c203fcc6c198f0e8469c22838a7106ee1a5d9034f2c817229834fa35b080880a` |
| BLT | [porblt_vpl.zip](https://ebible.org/Scriptures/porblt_vpl.zip) | `dc3b4ee61f2d428703a9ad88b573b7c90e68ca86985ff0938f74d2c98b9a1773` |

Foi usado o membro VPL XML, que fornece códigos de livro SIL/USFM e números de capítulo/versículo. A própria fonte já retira notas, introduções, títulos editoriais e formatação nesse formato. A conversão apenas organiza os registros por livro, apresenta nomes de livros em português e remove espaços nas extremidades. Não corrige vocabulário, doutrina, pontuação interna ou numeração. Não usa IA para traduzir ou completar versículos.

A conferência comparou todos os **108.178 textos de versículos** incorporados com o XML original após essa remoção de espaços: nenhum texto divergiu. Todos os capítulos estão numerados de 1 a N; não foram encontrados números zero, duplicatas ou sobreposição de versículos nos quatro pacotes incorporados. As diferentes contagens entre traduções são mantidas. O erro da TfTP foi identificado antes de qualquer gravação no catálogo; seu ZIP VPL examinado tem SHA-256 `fe7b81ab3020e97531a42b32a93d8adcffb3b882a41524677572ff36afdf1e96`.

O resultado contém 240 arquivos de livros, um manifesto e um arquivo de avisos: 242 arquivos, 21.934.476 bytes nesta geração. O maior JSON de livro tem 438.500 bytes. Esses números não medem consumo de memória do aplicativo nem validam renderização ou projeção.

## Reproduzir no desenvolvimento

```sh
python3 scripts/prepare-bibles.py --cache /caminho/temporario/bible-sources --download
```

Depois do primeiro download, omita `--download` para trabalhar somente com o cache. O script verifica hashes fixados e recusa alterações na fonte; uma nova edição exige revisão explícita antes de atualizar os hashes e contagens. O aplicativo e o build não executam esse script nem baixam Bíblias em runtime.

O script lê somente membros previamente definidos do ZIP, sem extrair caminhos, impõe limites de tamanho e rejeita DTD/declarações de entidades. Valida todos os datasets em uma pasta temporária antes de substituir os JSONs do catálogo. Os ZIPs de desenvolvimento não entram nos recursos distribuídos.

O contrato de `src-tauri/resources/bibles/manifest.json` é um array de versões com `id`, `name`, `abbreviation`, `language`, `license`, `licenseUrl`, `attribution`, `sourceUrl`, `sourceSha256` e `books`. Cada livro declara `id`, `name`, `chapterCount` e `file`; seu JSON contém `id`, `name` e `chapters`, com capítulos numéricos e versículos `{number: string, text: string}`. O número do versículo é string para preservar intervalos legítimos em futuras fontes.

## Avisos que acompanham os dados

`src-tauri/resources/bibles/THIRD_PARTY.txt` preserva os avisos das fontes e descreve a conversão. Os metadados `attribution`, `license`, `licenseUrl` e `sourceUrl` também contêm os elementos necessários para apresentar créditos dentro do aplicativo offline. Os avisos são parte legal dos dados, não um relatório de desenvolvimento.

A interface deve permitir consultar esses créditos, identificar a versão na apresentação e manter “rascunho” no nome da BPM. O formato de distribuição deve conservar a licença aberta dos dados e seus avisos; a pendência da licença do aplicativo não deve ser apresentada como restrição adicional aos textos sob Creative Commons. A [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) exige crédito, indicação de mudanças e referência à licença; a [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) também exige a mesma licença para as contribuições ao material adaptado.
