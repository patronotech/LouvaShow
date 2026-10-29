# Desenvolvimento no Windows

O Windows é a plataforma prioritária para operação. Estas instruções preparam o ambiente; não constituem confirmação de compatibilidade desta versão.

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

A distribuição offline deve contemplar a disponibilidade do WebView2 na máquina de destino. O instalador, sua assinatura e a instalação em máquina limpa ainda precisam de validação própria. Teste monitores com escalas diferentes e coordenadas negativas, bem como desconexão do cabo durante uma sessão de ensaio.

Referência: [pré-requisitos oficiais do Tauri para Windows](https://v2.tauri.app/start/prerequisites/#windows).
