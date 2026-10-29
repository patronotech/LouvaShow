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

Referência: [pré-requisitos oficiais do Tauri](https://v2.tauri.app/start/prerequisites/#macos).
