# Desenvolvimento no Windows

Windows 10/11 x64 é o destino prioritário dos instaladores da versão 0.6.0. Estas instruções preparam o ambiente; não constituem confirmação de compatibilidade desta versão.

Instale Node.js compatível com o Vite do projeto, Rust estável com toolchain MSVC, Microsoft C++ Build Tools com a carga **Desktop development with C++**, e Microsoft Edge WebView2 Runtime. Reinicie o terminal após a instalação.

No PowerShell, dentro do projeto:

```powershell
rustup default stable-msvc
node --version
rustc --version
npm ci
npm run tauri dev
```

Build e testes locais:

```powershell
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run tauri build -- --no-bundle
```

O workflow de distribuição prepara `LouvaShow-windows-x64-setup.exe` com NSIS e o instalador offline do WebView2 incorporado. Esse pacote é maior, mas permite instalar o runtime sem baixá-lo na máquina de destino. O CI não assina o EXE; instalação em máquina limpa e comportamento de segurança do Windows ainda precisam de validação própria. Consulte o [processo de release](build-release.md#instaladores-pelo-github-actions) e os resultados da versão publicada. Teste monitores com escalas diferentes e coordenadas negativas, bem como desconexão do cabo durante uma sessão de ensaio.

Referência: [pré-requisitos oficiais do Tauri para Windows](https://v2.tauri.app/start/prerequisites/#windows).

Não há ensaio de instalação ou operação nativa desta versão em Windows 10 ou 11 registrado. Compilação em runner e inspeção do NSIS não substituem esse teste. Verifique também permissão do microfone, cofre de credenciais e acesso pela LAN em um ambiente de ensaio. O servidor começa desligado; eventuais regras de firewall precisam ser limitadas à rede privada escolhida.

## Manifesto dos executáveis e testes

O build MSVC incorpora `windows-app-manifest.xml` pelo linker, tanto no aplicativo quanto nos executáveis de teste. A dependência Common Controls v6 permite resolver `TaskDialogIndirect`, utilizado pelos diálogos nativos. O manifesto padrão como recurso do aplicativo não alcançava o harness de testes: na CI 0.6.0, o processo encerrava antes de executar qualquer teste com `0xc0000139` (`STATUS_ENTRYPOINT_NOT_FOUND`), em Windows 2022 e windows-latest. A correção segue o [exemplo oficial do Tauri](https://github.com/tauri-apps/tauri/blob/dev/examples/api/src-tauri/build.rs); sua revalidação no Windows é registrada separadamente. O runner Windows 2022 e as mesmas suítes de testes foram mantidos.
