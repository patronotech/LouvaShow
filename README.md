<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/shared/assets/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="src/shared/assets/logo-light.png">
    <img src="src/shared/assets/logo-light.png" width="280" alt="LouvaShow">
  </picture>
</p>

<h1 align="center">LouvaShow</h1>

<p align="center">Louvores, repertórios e Bíblia na tela da igreja.<br>Operação local e offline, sem conta, assinatura, servidor ou chave de IA.</p>

<p align="center">
  <a href="https://github.com/dantetesta/LouvaShow/releases/latest/download/LouvaShow-windows-x64-setup.exe"><img src="https://img.shields.io/badge/Windows-Baixar_EXE-6941BA?style=for-the-badge&amp;logo=windows&amp;logoColor=white" alt="Baixar instalador Windows x64 — EXE"></a>
  <a href="https://github.com/dantetesta/LouvaShow/releases/latest/download/LouvaShow-macos-arm64.dmg"><img src="https://img.shields.io/badge/macOS-Baixar_DMG-34333D?style=for-the-badge&amp;logo=apple&amp;logoColor=white" alt="Baixar instalador macOS Apple Silicon — DMG"></a>
</p>

<p align="center"><a href="https://github.com/dantetesta/LouvaShow/releases/latest">Notas da versão e arquivos</a> · <a href="docs/branding.md">Logos oficiais</a> · <a href="https://chat.whatsapp.com/FTsYpsy6YbG8Z3gDI2u1Bp?mode=gi_t">Comunidade no WhatsApp</a></p>

## Instalar

- **Windows x64:** baixe o EXE e siga o instalador. É a plataforma prioritária de uso.
- **macOS Apple Silicon:** baixe o DMG, abra-o e copie o LouvaShow para Aplicativos. Consulte nas notas da versão o estado de assinatura e notarização do pacote.
- **Linux ou macOS Intel:** ainda não há instalador nesses links. Consulte as [instruções para Linux](docs/setup-linux.md) ou [macOS](docs/setup-macos.md) para compilar a partir do código.

Os botões apontam para os arquivos da última release pública. Confira as notas antes de instalar: esta é uma versão inicial, e os resultados de build e de uso real estão separados na [matriz de validação](docs/validation.md). Faça um ensaio com seu equipamento antes da primeira apresentação.

O LouvaShow tem como objetivo ser gratuito e open source. **A licença do código ainda precisa ser escolhida pelo mantenedor.** A disponibilização do código não concede, por si só, uma licença de distribuição. As licenças dos textos bíblicos são preservadas separadamente.

## O que você encontra

- Biblioteca com cadastro, busca, classificações e importação/exportação de músicas.
- Repertórios por evento, com reordenação por arraste, teclado ou botões.
- Operador e projeção em janelas separadas, com apagar/restaurar e prévia ao vivo.
- Quatro edições bíblicas em português incorporadas para consulta e projeção offline.
- Fonte, cores, alinhamento e caixa de texto ajustáveis em uma prévia de edição independente.
- Interface clara ou escura, painéis redimensionáveis e preferências locais.

## Autoria e comunidade

Idealização e desenvolvimento por **Dante Testa**. Conheça outros projetos em [www.dantetesta.com.br](https://www.dantetesta.com.br).

Quer sugerir melhorias, colaborar com o projeto ou reportar bugs? Participe do [grupo do LouvaShow no WhatsApp](https://chat.whatsapp.com/FTsYpsy6YbG8Z3gDI2u1Bp?mode=gi_t). O mesmo acesso está em **Créditos e comunidade** no aplicativo. As [quatro versões oficiais da logo](docs/branding.md) estão disponíveis para download.

## Apoie o desenvolvimento

O LouvaShow é gratuito. Se quiser contribuir com sua evolução, você pode apoiar por Pix ou PayPal. O apoio é voluntário e não é necessário para usar o programa.

**Chave Pix aleatória:**

```text
44b40705-0339-4583-bb58-bab854c3eea3
```

**PayPal — e-mail para apoio:**

```text
dante.testa@gmail.com
```

Os dois dados também estão em **Créditos e comunidade** no aplicativo. Expanda Pix ou PayPal para consultar e copiar. O aplicativo não processa pagamentos.

## Preparar e projetar

A navegação separa cinco áreas: **Operação ao vivo** para enviar blocos, **Repertórios** para montar a sequência de cada evento, **Músicas** para revisar e cadastrar letras, **Bíblia** para consultar e projetar passagens e **Configurações** para preparar a saída e consultar atalhos. Trocar de área preserva a música preparada e o conteúdo ao vivo. Na área Músicas, os blocos são somente leitura; a projeção musical direta fica na Operação ao vivo.

Arraste as bordas das laterais para ajustar sua largura ou recolhê-las. Pelo teclado, foque o separador e use as setas; Enter recolhe ou reabre, e Escape cancela um arraste. As dimensões ficam salvas por área. A prévia ao vivo permanece fixa enquanto os blocos e o repertório rolam de forma independente. Em janelas estreitas, use os botões Mostrar para alternar as laterais. Para restaurar as dimensões iniciais, acesse **Configurações → Aparência**.

1. Cadastre uma música usando conteúdo próprio ou autorizado. Separe os blocos da letra por linhas em branco, revise-os e salve.
2. Prepare uma música na biblioteca. A seleção e a edição são independentes do conteúdo ao vivo.
3. Crie ou selecione um repertório com o nome do evento, como “Culto de domingo · manhã”, e adicione as músicas. Uma música pode aparecer mais de uma vez; cada ocorrência tem sua própria identidade.
4. Confira a tela de saída e abra a projeção explicitamente. Com apenas um monitor, use a janela de prévia.
5. Escolha um bloco para projetar. Use os controles anterior/próximo para navegar dentro da música.
6. Apague e restaure a saída quando necessário. Ao fechar somente a janela de projeção, a sessão continua no aplicativo.

As teclas disponíveis aparecem na interface. Atalhos de apresentação atuam em Operação ao vivo e Bíblia e são ignorados em campos de edição, diálogos e controles de consulta. Os botões explícitos da barra de operação continuam disponíveis nas demais áreas. Confirme a saída real antes de cada culto.

Repertórios podem ser criados, renomeados e excluídos. A seleção e a ordem ficam salvas neste computador. Trocar de repertório preserva a música em preparação e o conteúdo ao vivo. Excluir um repertório remove somente sua lista de ocorrências; as músicas permanecem na biblioteca e nos outros repertórios. É necessário manter pelo menos um repertório.

## Aparência do aplicativo e da projeção

Em **Configurações → Aparência**, escolha **Escuro** ou **Claro**. A mudança é imediata, fica salva neste computador e altera somente os controles do operador; o tema da congregação permanece independente.

### Preparar o tema da saída

Em **Configurações → Projeção**, a prévia de edição acompanha imediatamente mudanças de fonte, tamanho, cores, alinhamento e área do texto. Clique na caixa de texto para revelar as alças; arraste as bordas para mudar as quebras de linha ou o interior para mover. Há campos percentuais e operação por teclado como alternativas. Escape cancela o arraste.

A prévia à direita continua mostrando a saída efetivamente ao vivo. **Aplicar à saída** envia o tema preparado e salva suas configurações. A caixa usa percentuais da tela; passagens bíblicas preservam a área da referência. A fonte se ajusta até o mínimo de 32; se o texto ainda não couber, ajuste a caixa ou o tema. Nas músicas, também é possível dividir o bloco; a Bíblia já usa paginação automática.

## Consulta bíblica offline

Em **Bíblia**, escolha a tradução, filtre o nome do livro e clique no capítulo. A grade seguinte mostra os versículos disponíveis naquela edição, preservando sua numeração original. Com a saída fechada, clicar prepara o texto; com a saída aberta, clicar projeta o versículo. O aviso acima da grade identifica esse comportamento.

Anterior/Próximo navegam nas páginas do capítulo que está na sessão. Versículos longos são divididos em partes identificadas, sem reescrever o texto; a referência e a sigla da versão aparecem na projeção. O último versículo não avança para outro capítulo automaticamente. Consultar outro livro ou tradução preserva a saída, e apagar/restaurar mantém a passagem selecionada.

O aplicativo inclui **quatro edições em português**, disponíveis sem download durante o uso:

| Edição | Cobertura |
| --- | --- |
| Bíblia Livre — fevereiro de 2018 | Antigo e Novo Testamento |
| Biblica® Open Nova Bíblia Viva™ | Antigo e Novo Testamento |
| Bíblia Portuguesa Mundial | Antigo e Novo Testamento e livros adicionais; rascunho em revisão |
| Bíblia Livre Para Todos | Somente Novo Testamento |

As licenças, a cobertura detalhada e as fontes estão em [Fontes bíblicas](docs/bible-sources.md) e nos créditos de cada versão dentro do programa. ARA e NVI não acompanham o aplicativo: não foi confirmada uma licença que permita distribuir seus textos completos neste pacote offline. A licença de cada texto bíblico é independente da licença ainda pendente do código do LouvaShow.

## Desenvolvimento

Prepare o ambiente conforme seu sistema: [macOS](docs/setup-macos.md), [Windows](docs/setup-windows.md) ou [Linux](docs/setup-linux.md). Na pasta do projeto:

```sh
npm ci
npm run tauri dev
```

O primeiro build baixa dependências. O aplicativo compilado opera offline; Vite é usado somente no desenvolvimento. O build padrão e a integração contínua não precisam do hinário privado.

### Verificações e build local

```sh
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run tauri build -- --no-bundle
```

Para gerar o aplicativo local de depuração no macOS:

```sh
npm run tauri build -- --debug --bundles app
```

O resultado fica em [src-tauri/target/debug/bundle/macos/LouvaShow.app](src-tauri/target/debug/bundle/macos/LouvaShow.app). Esse build não comprova assinatura, notarização ou prontidão para distribuição pública.

O build local não constitui teste em Windows, Linux ou projetor físico. Consulte [a matriz de validação](docs/validation.md) antes de interpretar qualquer resultado como suporte comprovado.

O frontend usa React e TypeScript estrito. O Rust coordena a apresentação e acessa o SQLite. A janela de projeção recebe apenas o snapshot necessário à renderização. Não há SQL arbitrário vindo da interface.

Veja [as decisões de arquitetura](docs/architecture.md), [o guia de contribuição](CONTRIBUTING.md) e [o roadmap](docs/roadmap.md).

O processo de assinatura, notarização e inspeção dos pacotes está em [Build e distribuição](docs/build-release.md). Credenciais de assinatura pertencem ao ambiente privado do mantenedor.

Os formatos e limites de intercâmbio da biblioteca estão em [Importação e exportação](docs/import-export.md), incluindo a distinção entre OpenLyrics e formatos próprios de outros programas.

A exportação atual transporta músicas e seus metadados; não inclui repertórios, sua ordem de músicas, preferências ou sessão de projeção. Ela não é um backup completo do aplicativo.

## Limitações atuais

Os repertórios por evento são locais; a versão atual não agenda eventos nem sincroniza repertórios entre computadores. Imagens e vídeos de fundo foram adiados para preservar o fluxo completo de projeção; os temas iniciais usam fundo sólido e são persistidos. A preferência de monitor ainda não é persistida. A sessão de apresentação permanece ao reabrir a janela de saída, mas não é restaurada após encerrar todo o aplicativo.

A disponibilidade de um instalador ou um build aprovado em CI não comprova a operação da interface naquele sistema. Windows, Linux, monitores externos e projetores físicos ainda exigem seus ensaios específicos; consulte a matriz de validação. Não há controle de ligar/desligar o projetor: ele é uma tela reconhecida pelo sistema operacional.

## Dados e distribuição

O banco pertence ao diretório de dados do aplicativo definido pelo Tauri para cada sistema. Dados pessoais não devem entrar no repositório nem em pacotes de instalação. Antes de copiar um banco para backup, feche o aplicativo; a cópia deve considerar eventuais arquivos auxiliares do SQLite.

O código público compila sem acervo musical incorporado. O build local solicitado pode incluir um catálogo opcional de 640 hinos, preservando seus avisos de copyright; sua redistribuição pública continua pendente da verificação dos direitos, além da escolha da licença do software.

Para um build local com esse catálogo autorizado para uso local, forneça o arquivo privado em `src-tauri/resources/hc_xml.zip` e habilite a feature:

```sh
npm run tauri build -- --features bundled-hymns --bundles app
```

O ZIP está excluído do Git e não é necessário para o build padrão nem para seus testes. Os testes específicos do catálogo são habilitados com `cargo test --manifest-path src-tauri/Cargo.toml --locked --features bundled-hymns` e exigem o arquivo privado. A instalação inicial do catálogo ocorre uma vez: músicas excluídas depois não reaparecem automaticamente ao reiniciar.

Os responsáveis pelo uso devem fornecer letras e mídia com autorização adequada. Pacotes para o público devem conter apenas runtime, metadados exigidos e avisos legais aplicáveis; documentação de desenvolvimento, testes, credenciais e arquivos de trabalho ficam fora.
