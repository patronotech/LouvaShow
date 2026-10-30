# Desenvolvimento no macOS

Instale Node.js compatível com a versão do Vite no lockfile e Rust estável via rustup. Para compilar um aplicativo desktop Tauri, as Xcode Command Line Tools são suficientes:

```sh
xcode-select --install
node --version
rustc --version
cargo --version
npm ci
npm run tauri dev
```

Para gerar um executável local sem instalador:

```sh
npm run tauri build -- --no-bundle
```

Assinatura, notarização e distribuição pública são etapas separadas. Um build de desenvolvimento não as comprova. Monitores adicionais e troca de escala exigem teste com o hardware real.

O workflow de distribuição prepara um DMG para Apple Silicon (`aarch64-apple-darwin`), sem assinatura Developer ID ou notarização no CI. Ele fica em um rascunho e deve ser substituído pelo pacote público assinado e notarizado localmente antes da publicação. O nome de download permanece `LouvaShow-macos-arm64.dmg`. Este fluxo não gera build Intel. Consulte [build e release](build-release.md#instaladores-pelo-github-actions).

Referência: [pré-requisitos oficiais do Tauri](https://v2.tauri.app/start/prerequisites/#macos).
