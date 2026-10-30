# Atualizações

## Para quem usa o programa

O LouvaShow consulta novas versões depois da abertura. Em **Configurações → Sobre**, **Verificar atualizações** repete a consulta. Sem internet, a biblioteca, a Bíblia e a projeção continuam disponíveis.

Quando houver uma versão nova, **Baixar e atualizar** abre a confirmação. Salve as edições e feche a janela de projeção. **Atualizar e reiniciar** baixa o pacote, verifica sua assinatura e instala. Uma assinatura inválida impede a instalação. Não há instalação automática durante uma apresentação.

No macOS, use o aplicativo instalado, não a cópia dentro de um DMG montado. O sistema pode pedir autorização para substituir um aplicativo em uma pasta protegida. No Windows, o instalador NSIS conduz a atualização. Os bancos e preferências locais ficam no diretório de dados, fora do aplicativo instalado.

Uma versão anterior à introdução do atualizador precisa ser substituída manualmente pelo instalador oficial. A presença desse recurso não comprova uma atualização real em todas as plataformas: confira os testes registrados nas notas da versão.

## Fluxo de distribuição

O [workflow de release](../.github/workflows/release.yml) produz um draft com três instaladores. Ele não recebe a chave privada updater e usa `createUpdaterArtifacts: false`. Os DMGs desse estágio ainda precisam ser substituídos pelos pacotes assinados e notarizados localmente. O draft não deve ser publicado antes da finalização abaixo.

1. Compile a tag pública exata e aguarde os testes e instaladores do CI.
2. Execute [release-macos.sh](../scripts/release-macos.sh) para `MACOS_ARCH=arm64` e `MACOS_ARCH=intel`, sempre com `INCLUDE_BUNDLED_HYMNS=0`. O script gera um DMG e um `.app.tar.gz` por arquitetura. O tar usa o aplicativo depois de assinatura Apple, notarização e staple; ele é reextraído e auditado antes da entrega.
3. Baixe o EXE do draft da mesma tag. Confira o hash do artifact e sua origem no CI. Esse EXE não deve ser executado no computador de preparação.
4. Reúna somente os cinco arquivos listados abaixo numa pasta limpa. Renomeie os DMGs locais para os nomes públicos estáveis.
5. Execute o finalizador local. Inspecione a saída e faça os ensaios da versão antes de publicar.
6. Substitua os instaladores provisórios do draft, anexe os novos pacotes e assinaturas e substitua o manifesto de hashes. Confirme os hashes e conteúdos remotos. Publique o draft somente quando todos os dez arquivos finais estiverem presentes.

Entrada exata do finalizador:

```text
LouvaShow-windows-x64-setup.exe
LouvaShow-macos-arm64.dmg
LouvaShow-macos-intel.dmg
LouvaShow-macos-arm64.app.tar.gz
LouvaShow-macos-intel.app.tar.gz
```

Não copie a pasta de evidências, hashes individuais intermediários, arquivos de chave, ZIPs de notarização ou recursos privados para essa pasta.

## Chave e assinatura local

O projeto usa o signer do Tauri CLI fixado no lockfile. A chave privada updater fica **somente no ambiente local protegido do mantenedor**, fora do repositório e das pastas de entrega. Nunca a adicione como secret do GitHub Actions. Mantenha um backup protegido; perder a chave impede assinar pacotes aceitos pelas instalações existentes.

A configuração pública contém somente a chave pública. Não substitua essa chave a cada release. Os certificados Apple e eventual certificado Authenticode são independentes da chave updater. [Assinatura no updater Tauri](https://v2.tauri.app/plugin/updater/)

Pré-requisitos locais: `npm ci`, Python 3.11 ou posterior, ferramentas Apple de validação e `minisign` para verificação independente. No macOS, `brew install minisign` instala o verificador. O finalizador não instala dependências nem publica arquivos.

Com a variável `TAURI_SIGNING_PRIVATE_KEY_PATH` já apontando para o arquivo protegido e, quando necessária, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` disponível no ambiente protegido:

```sh
python3 scripts/prepare-updater.py finalize \
  --input /caminho/artefatos-publicos \
  --output /caminho/release-final-nova \
  --version 0.7.4
```

O script recusa um diretório final existente. Ele passa o caminho da chave ao CLI por ambiente e não lê nem imprime os bytes privados. Não use `set -x` nem imprima o ambiente. Se precisar gerar uma chave nova, a opção `tauri signer generate --write-keys` grava em arquivo; sem essa opção, o comando imprime a chave privada. Não gere novamente a chave de uma distribuição existente. [CLI oficial](https://v2.tauri.app/reference/cli/)

O finalizador assina com `--app-version`, verifica cada assinatura com Minisign e exige o comentário autenticado da versão. Não assine antes de modificar o artefato: assinatura Apple, staple ou Authenticode precisam estar concluídos primeiro. [Formato e vínculo de versão no signer](https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/src/helpers/updater_signature.rs)

## Verificações e arquivos finais

O finalizador exige exatamente os cinco pacotes de entrada; confere a versão no recurso PE do EXE e no `Info.plist` dos Macs; recusa arquivos extras, links, travessia de diretórios e metadados locais nos tarballs; compara o aplicativo de cada DMG com o tar correspondente; e revalida arquitetura, assinatura Apple e ticket. Ele não inicia os instaladores e não substitui testes reais de atualização.

A saída contém dez arquivos: os cinco pacotes, três assinaturas (`.exe.sig` e duas `.app.tar.gz.sig`), `latest.json` e `SHA256SUMS.txt`. O manifesto de hashes cobre os outros nove arquivos. Nenhum relatório, banco, certificado, chave privada ou documento de desenvolvimento deve acompanhar a distribuição.

O endpoint de descoberta é `https://github.com/dantetesta/LouvaShow/releases/latest/download/latest.json`. Dentro dele, as URLs usam uma tag específica `releases/download/vMAJOR.MINOR.PATCH/…`, evitando misturar versões. As plataformas são `windows-x86_64`, `darwin-aarch64` e `darwin-x86_64`. Cada `signature` contém o texto integral do respectivo `.sig`, não um caminho ou URL. O manifesto exige versão SemVer e usa data RFC 3339. [Formato oficial](https://v2.tauri.app/plugin/updater/#static-json-file)

No tar macOS, a raiz é exatamente `LouvaShow.app/Contents/…`. Não adicione uma pasta envolvente nem copie o link `Applications` do DMG. Mantenha `productName: LouvaShow`, `identifier: app.louvashow.desktop` e o executável `louvashow`; mudanças de identidade exigem um plano de migração dos dados.

Testes dos guardas de empacotamento, sem credenciais reais:

```sh
python3 scripts/test-updater-release.py
bash -n scripts/release-macos.sh
```

Esses testes usam bundles sintéticos e uma chave temporária descartável. Eles não comprovam notarização ou instalação real. O destino Windows 10/11 continua usando NSIS x64 com WebView2 offline; CI em Windows Server não comprova atualização no Windows 10. Assinatura updater não remove avisos de SmartScreen nem transforma o EXE em um binário com Authenticode.
