# LouvaShow

Aplicativo desktop para preparar repertórios e projetar letras em igrejas, com operação local e offline. O objetivo é oferecer uma ferramenta gratuita e open source, simples para voluntários. Não requer conta, assinatura, servidor ou chave de IA.

**Versão inicial em desenvolvimento. A licença ainda precisa ser escolhida pelo mantenedor.** A disponibilização do código não concede, por si só, uma licença de distribuição.

## Comunidade

Quer sugerir melhorias, colaborar com o projeto ou reportar bugs? Participe do [grupo do LouvaShow no WhatsApp](https://chat.whatsapp.com/FTsYpsy6YbG8Z3gDI2u1Bp?mode=gi_t).

## Começar

Prepare o ambiente conforme seu sistema:

- [macOS](docs/setup-macos.md)
- [Windows](docs/setup-windows.md), plataforma prioritária de uso
- [Linux](docs/setup-linux.md)

Depois, na pasta do projeto:

```sh
npm ci
npm run tauri dev
```

O primeiro build baixa dependências. O aplicativo compilado deve funcionar sem internet; o servidor Vite é apenas uma ferramenta de desenvolvimento.

## Operação

1. Cadastre uma música usando conteúdo próprio ou autorizado. Separe os blocos da letra por linhas em branco, revise-os e salve.
2. Prepare uma música na biblioteca. A seleção e a edição são independentes do conteúdo ao vivo.
3. Crie ou selecione uma playlist com o nome do evento, como “Culto de domingo · manhã”, e monte o repertório. Uma música pode aparecer mais de uma vez; cada ocorrência tem sua própria identidade.
4. Confira a tela de saída e abra a projeção explicitamente. Com apenas um monitor, use a janela de prévia.
5. Escolha um bloco para projetar. Use os controles anterior/próximo para navegar dentro da música.
6. Apague e restaure a saída quando necessário. Ao fechar somente a janela de projeção, a sessão continua no aplicativo.

As teclas disponíveis aparecem na interface. Atalhos de apresentação são ignorados em campos de edição e diálogos. Confirme a saída real antes de cada culto.

Playlists podem ser criadas, renomeadas e excluídas. A seleção e a ordem ficam salvas neste computador. Trocar de playlist preserva a música em preparação e o conteúdo ao vivo. Excluir uma playlist remove somente sua lista de ocorrências; as músicas permanecem na biblioteca e nas outras playlists. É necessário manter pelo menos uma playlist.

## Desenvolvimento e verificação

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

A exportação atual transporta músicas e seus metadados; não inclui playlists, ordem do repertório, preferências ou sessão de projeção. Ela não é um backup completo do aplicativo.

## Limites desta sessão

As playlists por evento são locais; a versão atual não agenda eventos nem sincroniza repertórios entre computadores. Imagens e vídeos de fundo foram adiados para preservar o fluxo completo de projeção; os temas iniciais usam fundo sólido e são persistidos. A preferência de monitor ainda não é persistida. A sessão de apresentação permanece ao reabrir a janela de saída, mas não é restaurada após encerrar todo o aplicativo.

Windows, Linux, projetor físico, reprodução de vídeo e instaladores públicos precisam de validação própria. Não há controle de ligar/desligar o projetor: ele é uma tela reconhecida pelo sistema operacional.

## Dados e distribuição

O banco pertence ao diretório de dados do aplicativo definido pelo Tauri para cada sistema. Dados pessoais não devem entrar no repositório nem em pacotes de instalação. Antes de copiar um banco para backup, feche o aplicativo; a cópia deve considerar eventuais arquivos auxiliares do SQLite.

O código público compila sem acervo musical incorporado. O build local solicitado pode incluir um catálogo opcional de 640 hinos, preservando seus avisos de copyright; sua redistribuição pública continua pendente da verificação dos direitos, além da escolha da licença do software.

Para um build local com esse catálogo autorizado para uso local, forneça o arquivo privado em `src-tauri/resources/hc_xml.zip` e habilite a feature:

```sh
npm run tauri build -- --features bundled-hymns --bundles app
```

O ZIP está excluído do Git e não é necessário para o build padrão nem para seus testes. Os testes específicos do catálogo são habilitados com `cargo test --manifest-path src-tauri/Cargo.toml --locked --features bundled-hymns` e exigem o arquivo privado. A instalação inicial do catálogo ocorre uma vez: músicas excluídas depois não reaparecem automaticamente ao reiniciar.

Os responsáveis pelo uso devem fornecer letras e mídia com autorização adequada. Pacotes para o público devem conter apenas runtime, metadados exigidos e avisos legais aplicáveis; documentação de desenvolvimento, testes, credenciais e arquivos de trabalho ficam fora.
