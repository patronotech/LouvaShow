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

Na versão 0.6.0, o workflow prepara DMGs separados para Apple Silicon (`aarch64-apple-darwin`) e Intel (`x86_64-apple-darwin`), sem assinatura Developer ID ou notarização no CI. Ambos ficam em rascunho e devem ser substituídos pelos pacotes públicos assinados e notarizados antes da publicação. Os nomes estáveis são `LouvaShow-macos-arm64.dmg` e `LouvaShow-macos-intel.dmg`. Compilar para Intel não comprova execução em um Mac Intel; essa validação permanece pendente. O ensaio nativo registrado foi parcial, em Apple Silicon com dados isolados. Consulte [build e release](build-release.md#instaladores-pelo-github-actions).

Referência: [pré-requisitos oficiais do Tauri](https://v2.tauri.app/start/prerequisites/#macos).

O script local de release aceita `MACOS_ARCH=arm64` ou `MACOS_ARCH=intel` e exige uma máquina Apple Silicon com os dois targets Rust instalados. A captura de microfone pede consentimento do macOS; o cofre Groq utiliza o Keychain. Chamadas reais ao serviço e captura de áudio ainda exigem ensaio próprio.
