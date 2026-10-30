# Desenvolvimento no Linux

A arquitetura preserva o Linux como alvo. A execução nesta plataforma precisa de validação nativa, incluindo compositor, WebKitGTK e formatos de mídia utilizados.

Instale Node.js compatível com o Vite do projeto, Rust estável e as dependências nativas da sua distribuição. Em Debian/Ubuntu, a documentação do Tauri lista WebKitGTK 4.1 e ferramentas de compilação, entre outras bibliotecas. Use a [lista oficial por distribuição](https://v2.tauri.app/start/prerequisites/#linux) para preparar o sistema.

Na pasta do projeto:

```sh
npm ci
npm run tauri dev
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run tauri build -- --no-bundle
```

## Wayland

O posicionamento absoluto de janelas não é suportado pela API de Tao em Wayland. Quando o compositor não permitir posicionamento automático, abra a projeção em janela e mova-a manualmente para a tela pretendida antes de ativar tela cheia. Não interprete uma coordenada solicitada como prova de que a janela chegou ao monitor correto. Referência: [Tao — set_outer_position](https://docs.rs/tao/latest/tao/window/struct.Window.html#method.set_outer_position).

Teste também uma sessão X11 quando disponível. Resultados de um compositor não comprovam comportamento em todos os ambientes Linux.

Na versão 0.6.0, o assistente opcional usa um cofre compatível com Secret Service para a chave Groq. Se esse serviço não estiver disponível, configurar ou ler a chave pode falhar; a operação local com IA desligada continua independente dele. Acesso da equipe é HTTP opt-in pela interface escolhida, sem configurar TLS ou domínio automaticamente.
