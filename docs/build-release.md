# Build local e preparação de distribuição

Publicar o código-fonte, gerar um aplicativo local, assinar e notarizar são operações distintas. Esta página descreve o processo; não afirma que um artefato específico foi publicado ou aprovado. Consulte o registro de validação para resultados efetivamente obtidos.

## Código-fonte público

Prepare o commit com uma lista positiva: fontes React/TypeScript e Rust, manifestos e lockfiles, configuração do Vite/Tauri, capabilities, recursos gráficos indispensáveis e documentação pública. O repositório de desenvolvimento pode conter testes e documentação; o aplicativo distribuído deve conter somente runtime e avisos exigidos.

Não inclua instruções de agentes, arquivos de contexto, `.env`, credenciais, certificados, bancos de usuários, logs, backups, caches, diretórios de build ou resultados de ensaios. Pacotes de letras com direitos ainda não confirmados ficam fora da publicação pública. Confira também arquivos ignorados antes de adicionar uma pasta inteira ao Git.

O código público precisa compilar e testar sem fixtures privadas. Um catálogo local opcional não deve virar dependência obrigatória do build padrão. A decisão da licença e os direitos de qualquer conteúdo incorporado precisam estar registrados antes da distribuição pública correspondente.

Neste projeto, a feature `bundled-hymns` habilita o catálogo privado em `src-tauri/resources/hc_xml.zip` e os testes que dependem dele. Ela está desabilitada por padrão. Não inclua esse ZIP no commit público nem habilite a feature em uma distribuição pública sem confirmar os direitos correspondentes.

## Verificações de código

```sh
npm ci
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
```

Essas verificações não substituem operar a interface nativa e observar a janela de projeção. Build macOS não comprova execução em Windows ou Linux.

## Assinatura local no macOS

O certificado adequado deve estar instalado no Keychain da máquina de build. A identidade é fornecida por `APPLE_SIGNING_IDENTITY`, configurada apenas no ambiente local, sem gravar seu valor no código ou em arquivos versionados. O Tauri aceita essa variável para selecionar a assinatura. [Documentação oficial](https://v2.tauri.app/distribute/sign/macos/)

Com o ambiente local já configurado:

```sh
npm run tauri build -- --bundles app
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/LouvaShow.app
```

Não trate assinatura ad hoc como assinatura de distribuição. Não exporte o certificado nem a chave privada para o repositório. Não altere o aplicativo depois de assinado; mudanças no bundle exigem nova assinatura e revalidação.

## Notarização com credenciais protegidas

Configure previamente um perfil de credenciais no Keychain usando as ferramentas da Apple. Neste procedimento, `NOTARY_KEYCHAIN_PROFILE` é uma variável local que aponta para esse perfil; não é uma opção automática do Tauri. O comando de envio usa o perfil sem colocar senha, token ou chave no arquivo de projeto.

Prepare um ZIP contendo somente o aplicativo assinado, em uma pasta de artefatos excluída do controle de versão:

```sh
mkdir -p artifacts/macos
ditto -c -k --sequesterRsrc --keepParent \
  src-tauri/target/release/bundle/macos/LouvaShow.app \
  artifacts/macos/LouvaShow-notarization.zip
xcrun notarytool submit artifacts/macos/LouvaShow-notarization.zip \
  --keychain-profile "$NOTARY_KEYCHAIN_PROFILE" --wait
```

Somente após o serviço retornar aprovação, anexe e valide o ticket:

```sh
xcrun stapler staple src-tauri/target/release/bundle/macos/LouvaShow.app
xcrun stapler validate src-tauri/target/release/bundle/macos/LouvaShow.app
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/LouvaShow.app
spctl --assess --type execute src-tauri/target/release/bundle/macos/LouvaShow.app
```

A submissão inicial não basta: registre separadamente a aceitação, o ticket anexado e a avaliação local. Mantenha logs técnicos completos somente no ambiente privado quando contiverem detalhes da conta ou da máquina. Referência: [Apple — notarização antes da distribuição](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

## Pacote final

Gere o pacote final a partir do aplicativo já assinado e com ticket anexado. Liste seus arquivos, procure nomes sensíveis, confira os recursos efetivamente necessários, teste a integridade do ZIP e calcule seu SHA-256. Abra o próprio aplicativo empacotado e faça o ensaio de projeção. Não acrescente documentação interna, fixtures, fontes de terceiros sem autorização, relatórios ou bancos pessoais ao bundle.

Não publique automaticamente o instalador ou ZIP como consequência de um push do código. Uma publicação de binário deve identificar versão, sistema e arquitetura realmente produzidos, resultados de assinatura/notarização e limitações ainda não testadas.

## Instaladores pelo GitHub Actions

O workflow `.github/workflows/release.yml` prepara três instaladores a partir de uma tag estável `vMAJOR.MINOR.PATCH`:

| Runner | Destino | Asset estável |
| --- | --- | --- |
| Windows 2022 | Windows x64, NSIS | `LouvaShow-windows-x64-setup.exe` |
| macOS 15 | macOS Apple Silicon, DMG | `LouvaShow-macos-arm64.dmg` |
| macOS 15 | macOS Intel, DMG | `LouvaShow-macos-intel.dmg` |

Os jobs auditam os arquivos públicos, conferem a correspondência entre tag e versões dos manifestos, executam testes e Clippy e usam os lockfiles. O build passa `--no-default-features`; o ZIP privado não pode existir no checkout. A configuração temporária ativa o empacotamento e incorpora o instalador offline do WebView2 no EXE, para que a instalação desse runtime não exija download na máquina da igreja. O build no CI exige internet. [Opções oficiais do instalador Windows](https://v2.tauri.app/distribute/windows-installer/).

Somente depois do sucesso dos três jobs, um job separado com `contents: write` cria uma **release em rascunho** contendo os três assets e `SHA256SUMS.txt`. Os jobs de build têm apenas leitura do repositório. As actions são fixadas por SHA. Não são usados certificados nem credenciais de assinatura no CI. Referências: [Tauri no GitHub Actions](https://v2.tauri.app/distribute/pipelines/github/) e [runners do GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

Um push de tag inicia a preparação; a publicação permanece manual. Para repetir a execução sobre uma tag já existente, use `gh workflow run release.yml --ref vMAJOR.MINOR.PATCH`. Executar sobre uma branch falha na validação. O workflow recusa sobrescrever uma release existente, inclusive rascunhos; os instaladores dessa execução continuam disponíveis nos artifacts do Actions por 14 dias.

Os DMGs do CI não possuem assinatura Developer ID nem notarização, e o EXE não possui assinatura Authenticode. **Antes de publicar o rascunho, substitua cada DMG pelo build público da arquitetura correspondente, assinado e notarizado localmente**, com `INCLUDE_BUNDLED_HYMNS=0`, mantendo os nomes `LouvaShow-macos-arm64.dmg` e `LouvaShow-macos-intel.dmg`. Gere também os dois tarballs públicos, assine os três pacotes do atualizador e finalize `latest.json` e `SHA256SUMS.txt` conforme [o fluxo de atualização](updating.md). A release final contém dez arquivos; os hashes cobrem os outros nove arquivos de distribuição. Confira assinatura, ticket, hashes e conteúdo dos pacotes, instale os próprios artefatos e atualize as notas com os resultados reais. Não publique o aviso provisório de assinatura do CI como se descrevesse um DMG já substituído. [Assinatura macOS no Tauri](https://v2.tauri.app/distribute/sign/macos/).

Após a revisão e publicação de uma release estável, os links permanentes usados pelo README são:

- [Windows x64](https://github.com/dantetesta/LouvaShow/releases/latest/download/LouvaShow-windows-x64-setup.exe)
- [macOS Apple Silicon](https://github.com/dantetesta/LouvaShow/releases/latest/download/LouvaShow-macos-arm64.dmg)
- [macOS Intel](https://github.com/dantetesta/LouvaShow/releases/latest/download/LouvaShow-macos-intel.dmg)

Esses links só funcionam quando a última release pública contém os assets com esses nomes. Rascunhos não ficam disponíveis nesses endereços. Não há instalador Linux ou Windows ARM neste workflow; um build automatizado também não comprova operação com projetor real.

Para a distribuição pública, o script local exige `BUILD_APP=1` e compila com `--locked --no-default-features`. Ele recusa a reutilização de um bundle via `BUILD_APP=0` nesse modo, porque o catálogo opcional pode estar embutido no executável mesmo sem um ZIP visível nos recursos.

## Recursos de runtime da versão 0.7.0

O bundle inclui as interfaces de operador, abertura, projeção e músico, a animação silenciosa, ícones e avisos legais bíblicos necessários. Os bancos locais, sessões da equipe e cache de avatares são criados no diretório de dados do aplicativo; preferências de leitura também podem ficar no armazenamento do navegador, e as chaves Groq, OpenAI e Gemini pertencem ao cofre do sistema. Nenhum desses dados privados deve integrar instaladores. O servidor LAN fica desligado a cada inicialização e não exige serviço separado.

A licença do código continua pendente de escolha do mantenedor. Os avisos das Bíblias não concedem uma licença ao código. Registre separadamente o resultado de cada build, assinatura, notarização, inspeção de conteúdo e execução nativa; não transfira evidência de Apple Silicon para Intel ou Windows.
