# Proposta — Cifras e equipe na rede

Este documento registra o planejamento anterior à versão 0.6.0; não é uma lista de funções entregues. O [guia de uso atual](user-guide-charts.md) descreve o que foi implementado. Em particular, o acesso atual usa HTTP por IP, sem TLS, domínio automático ou presença em tempo real; Groq está disponível apenas no desktop.

Estado: proposta de produto e arquitetura, ainda não implementada. Pesquisa em 30/10/2026. A introdução em vídeo da versão em desenvolvimento é uma entrega separada.

## Objetivo e limites

Uma música da biblioteca pode ter várias cifras: completa, simplificada, violão, teclado ou versão pessoal. O músico prepara seu repertório e lê a cifra no celular, tablet ou computador. O operador decide quando disponibilizar o serviço na rede interna.

O núcleo continua local: React/TypeScript, Rust e SQLite. Internet é necessária somente para ações externas opcionais, como consultar Gravatar, importar de um provedor autorizado e pedir ajuda à Groq. Nenhuma dessas ações é requisito para editar, transpor ou ler cifras. Sem partituras, tablaturas, reconhecimento de áudio, nuvem pública ou edição simultânea caractere a caractere nesta primeira versão.

“Compartilhado” significa disponível para os membros autorizados desta instalação/igreja. Não significa publicado na internet.

## Editor como primeira entrega

Na música, uma aba Cifras lista variantes e permite Criar com esta letra, Duplicar e Importar. Criar herda uma cópia versionada dos blocos e preserva a autoria/origem.

- Clicar ou tocar na posição da letra abre a inserção de acorde, com sugestões de símbolos já usados.
- Acorde pode ser editado, removido ou reposicionado por arraste, teclado e toque com controles de ajuste.
- Âncora é ID da linha + posição entre grafemas Unicode; não é uma quantidade de espaços nem uma coordenada em pixels.
- O acorde acompanha seu trecho ao mudar fonte/largura. Acordes longos ou próximos reservam espaço sem sobreposição; acordes consecutivos e linhas instrumentais sem letra são suportados.
- Cada seção possui identidade própria. A sequência pode ser Intro → Estrofe → Refrão → Estrofe → Refrão → Ponte → Final, reutilizando seções sem copiar a música inteira.
- Editar todas as ocorrências e Criar variação desta ocorrência são ações distintas e explícitas.
- Desfazer/refazer, recuperação de rascunho, estado de salvamento e prévia fiel fazem parte do editor. Salvar grava uma revisão; um rascunho recuperado não substitui uma versão publicada.
- Alterar a letra de origem informa que há uma atualização e oferece comparação. Nunca deslocar os acordes automaticamente para outra sílaba nem modificar a saída ao vivo.

Armazenamento interno estruturado e versionado. ChordPro é o primeiro formato de intercâmbio: `[D]Uma frase [G]de exemplo`. Importar/exportar um subconjunto documentado; diretivas desconhecidas são preservadas ou sinalizadas, nunca descartadas silenciosamente. [Especificação](https://www.chordpro.org/chordpro/chordpro-introduction/).

## Tom, transposição e capotraste

Três informações independentes: **tom real**, **capotraste** e **formas exibidas**. Em afinação padrão e capo completo, som real = formas + casa do capo, em semitons, módulo 12. Exemplo: formas de D com capo 2 soam em E. Trocar o capo preserva o tom real e recalcula as formas; mudar o tom real transpõe a harmonia.

A regra vale para os acordes completos. Subir dois semitons transforma D/F# em E/G#, mantendo qualidade e extensões. O parser distingue baixo invertido de extensões como 6/9, aceita grafias brasileiras comuns e preserva anotações/N.C. Símbolo não reconhecido recebe aviso, sem correção silenciosa. [Estrutura dos acordes](https://www.chordpro.org/chordpro/chordpro-chords/).

O tom inicial é confirmado pelo usuário. Metadados importados podem preenchê-lo; uma heurística posterior sugere candidatos com base na harmonia. Letra sozinha não determina tonalidade. Primeiro acorde também não é prova suficiente. Modulações e trechos sem tom definido exigem indicação explícita/revisão, sem inventar uma única tonalidade.

Sugestões locais enumeram capo 0–5 e avaliam os acordes da sequência inteira: formas abertas, pestanas prováveis, baixos e preferências do instrumento. Oferecer até três alternativas com explicação, sem prometer facilidade universal. A primeira versão assume afinação padrão e capo completo; afinações alternativas e capo parcial ficam fora da sugestão automática.

Tecladista e baixista podem ver o tom real enquanto violonista vê suas formas com capo, todos no mesmo tom do evento. Preferência de capo é pessoal; não altera a cifra dos outros músicos. Transposição não converte automaticamente maior em menor nem simplifica a harmonia.

Na entrada/saída ChordPro, converter a semântica: `{key: C}` junto de `{capo: 2}` representa formas de C e som real D. Não somar o capo duas vezes. [Diretiva oficial de capo](https://www.chordpro.org/chordpro/directives-capo/).

## Groq opcional

Proposta: Configurações → Assistência musical → Groq, inicialmente desativada. Campos para chave secreta e modelo compatível, ações Testar conexão e Remover chave. Chamadas somente pelo Rust, com armazenamento no cofre do sistema; a chave nunca vai para o navegador dos músicos, exportações, logs, SQLite em texto aberto ou GitHub. Validar suporte de cofre no sistema alvo antes de oferecer armazenamento persistente.

O botão Pedir sugestão à IA envia tom real, sequência estruturada de acordes, instrumento, limite de capo e preferências. Não precisa enviar letra, e-mail, fotos ou a biblioteca inteira. A interface informa o envio externo; sugestões locais continuam disponíveis offline.

O motor local gera candidatos musicalmente válidos. A IA recebe candidatos identificados e pode ordená-los e explicar os compromissos. Resposta estruturada contém IDs dos candidatos e justificativas curtas; o backend rejeita referências desconhecidas e valida novamente limite 0–5, tom e acordes. A resposta não é aplicada automaticamente. JSON válido não comprova correção musical.

Groq oferece JSON Schema em modelos compatíveis. Seleção de modelo e suporte precisam ser conferidos na implementação; não fixar modelo experimental nem prometer qualidade sem avaliação. Não houve chamada paga ou teste musical real nesta pesquisa. [Structured Outputs](https://console.groq.com/docs/structured-outputs), [segurança de chaves](https://console.groq.com/docs/production-readiness/security-onboarding).

Timeout, cancelamento, falha de credencial, quota e HTTP 429 retornam mensagem útil e mantêm as opções locais. Limitar tamanho de entrada/saída, frequência e concorrência, com cache por conteúdo/revisão e configuração. Uso por músicos da LAN depende de permissão do operador e limites definidos por instalação. Preço, disponibilidade e retenção são condições do provedor; não anunciar IA gratuita ou retenção zero universal. [Limites](https://console.groq.com/docs/rate-limits), [dados](https://console.groq.com/docs/your-data).

## Ditado por voz e organização da letra

Configurações independentes, todas opcionais:

- Ativar Groq: chave protegida e conexão testável, com estado configurado/erro sem expor a chave.
- Transcrição por voz: habilita microfone nos campos de texto compatíveis.
- Organização de letra com IA: habilita Sugerir divisões no editor da letra.
- Sugestões musicais com IA: habilita assistência de capo, sem depender dos outros dois recursos.

Desativar Groq suspende todos os recursos externos e oculta seus controles nos formulários. Desativar um recurso específico oculta somente seus próprios controles. Permissões do perfil também se aplicam. Indicar claramente se o recurso está habilitado mas temporariamente indisponível por rede/quota; não testar a conexão continuamente.

Ditado inicial em título, artista, letra, nome de repertório e notas. Não incluir microfone em chaves secretas, senhas, cores, seletores ou campos numéricos; e-mails continuam como campos de identidade com entrada apropriada, sem correção automática por IA. Microfone com rótulo acessível, estados Gravando/Transcrevendo, duração e ações Parar/Cancelar. Solicitar somente áudio após clique explícito; parar as tracks ao concluir, cancelar, fechar o formulário ou desativar o recurso. Nunca gravar automaticamente ao abrir a tela.

Primeira implementação: gravar trecho curto, parar, enviar para transcrição e mostrar resultado editável antes de inserir. Não prometer transcrição contínua em streaming. Preservar a seleção/cursor de destino e inserir sem apagar o texto existente. Se o campo mudar durante a chamada ou o formulário fechar, não inserir em outra posição/campo: manter o resultado numa prévia e pedir destino. Desfazer a inserção em uma operação.

A Groq documenta `/audio/transcriptions`, Whisper Large V3 e Turbo, parâmetro de idioma e arquivos como WebM/MP4/WAV. Usar transcrição em português, não o endpoint que traduz para inglês. Negociar o formato que o navegador realmente grava; validar MIME, bytes, tamanho e duração no Rust. Definir limite curto do aplicativo e revalidar limites do provedor na implementação. Arquivo temporário de áudio é descartado após a operação, inclusive em falhas; não integra backup ou log. [Groq Speech to Text](https://console.groq.com/docs/speech-to-text).

No navegador, captura exige contexto seguro e permissão. Isso reforça HTTPS no módulo LAN; uma chave configurada não desbloqueia o microfone sobre HTTP inseguro. No desktop, conferir permissões de captura e metadados/entitlements exigidos por cada sistema; testar macOS/Windows/Linux separadamente. Se não houver suporte ou permissão, preservar a digitação normal e explicar o motivo em uma mensagem curta. [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

Sugerir divisões é uma chamada de modelo de texto, independente do Whisper. Envia somente a letra em edição e retorna posições propostas para quebras de linha/estrofe, com rótulos opcionais. O aplicativo reconstrói o resultado a partir do texto original e valida posições, ordem e limites: não aceitar palavras criadas, removidas ou trocadas. Não completar versos, consultar a música na internet ou reescrever conteúdo como efeito dessa ação. Trecho em um parágrafo pode receber divisões sugeridas; palavras sem espaços ou estrutura musical ambígua exigem revisão humana.

Exibir comparação Original/Sugerido ou blocos resultantes, permitindo ajustar e Aceitar/Descartar. Nenhum salvamento automático na música e nenhum efeito na projeção. Se a letra mudar enquanto a IA responde, a resposta é marcada desatualizada; nunca substituir a edição nova. Sugestões ficam vinculadas à revisão exata que foi enviada. Importação de cifra com âncoras exige revisão específica antes de reorganizar sua letra.

Falhas de microfone, silêncio, transcrição imprecisa, timeout, chave inválida e quota não apagam conteúdo. Texto de transcrição permanece para revisão; organização não é automaticamente encadeada ao ditado. Acesso dos músicos usa o servidor Rust e limites por usuário/instalação; a chave permanece somente no computador anfitrião. Nenhuma gravação ou chamada à Groq foi realizada durante o projeto desta proposta.

## Repertório e leitura

Cada membro tem repertórios independentes. Um item identifica música, revisão da cifra e tom do evento; a mesma música pode aparecer mais de uma vez, em tons ou versões diferentes. Preferências visuais e capo pertencem ao músico/dispositivo.

Ao Iniciar repertório, abrir leitura limpa: conteúdo, referência discreta de música/versão, tom/capo e navegação anterior/próximo. Menu recolhido oferece Voltar ao gestor, fonte, cores, rolagem e tela cheia quando disponível. Tocar no conteúdo revela os controles; foco por teclado permanece acessível.

Celular usa um painel. Quando houver largura suficiente, permitir dois painéis independentes: músicas diferentes ou a mesma cifra com configurações distintas. Fonte nunca é reduzida automaticamente até ficar ilegível. Modo de duas páginas sequenciais é uma opção diferente de dois documentos independentes.

Primeiras melhorias úteis: notas pessoais, favoritos, posição de leitura recuperada, rolagem automática manualmente ajustável, exportar ChordPro e indicação de conexão/salvamento. Pedal Bluetooth que se comporte como teclado pode ser estudado depois, com ensaio em dispositivos reais. Não exigir microfone ou IA para rolagem.

Se o servidor desligar, o texto já carregado permanece na tela. Escritas ficam indisponíveis ou em rascunho claramente não sincronizado; nunca mostrar Salvo sem confirmação. Retomar conexão consulta revisão atual. Edição offline completa/sincronização de conflitos é etapa posterior.

## Perfis, entrada e permissões

Cadastro: nome, e-mail e ao menos uma função. Lista inicial editável: pastor(a), dirigente de culto, líder de louvor, ministro(a) de louvor, vocalista, back vocal, violonista, guitarrista, baixista, tecladista, pianista, baterista, percussionista, regente, coralista, operador(a) de projeção, técnico(a) de som, operador(a) de transmissão, apoio e outro. Permitir mais de uma função.

Função na igreja é informação do perfil; permissões administrativas são separadas. Ser pastor no cadastro não concede acesso ao banco ou ao comando de projeção.

Digitar e-mail não comprova identidade. Proposta sem senha: a pessoa informa o e-mail; no primeiro acesso daquele dispositivo, o operador aprova um código de pareamento presencial. Depois, uma sessão persistente lembra o dispositivo. Novo dispositivo precisa de nova aprovação. Não é necessário enviar e-mail ou contratar um serviço de autenticação.

O objetivo é permanecer conectado até sair/revogar. Não prometer sessão literalmente eterna: limpeza de dados do navegador, mudança de endereço e políticas do dispositivo podem exigir nova entrada. O operador pode revogar uma sessão ou todas as sessões de um perfil. Token secreto é aleatório e apenas seu hash fica no banco. A identidade efetiva vem da sessão validada, nunca de um userId escolhido pela requisição.

Autorização por operação: consultar biblioteca compartilhada; editar somente suas variantes/repertórios; propor publicação; aprovar/publicar conforme permissão. Excluir letra base, biblioteca comum e administrar serviço permanecem operações do desktop ou de administradores explicitamente autorizados.

## Rede local e painel do operador

Nova área Equipe com estado do servidor, Ativar/Desativar, interface de rede, URL/QR e dispositivos. Inicialmente desligado a cada abertura. Cards mostram nome, função, foto/iniciais, última atividade e estado conectado/ausente. Sessão lembrada não significa pessoa online. Heartbeat ou conexão ativa determina presença, com prazo de ausência definido.

Proposta técnica: servidor Rust embutido, por exemplo Axum, frontend React/Vite de navegador empacotado e API limitada chamando os mesmos casos de uso. Não compartilhar SQLite pela rede nem expor comandos Tauri, monitores, arquivos ou apresentação. Desligar fecha escuta/conexões e conclui transações já aceitas de modo limitado; não mexe no slide da congregação. Sem abertura automática de portas do roteador ou exposição pública.

`louvashow.local:porta` é candidato a descoberta mDNS; suporte depende dos dispositivos, multicast e configuração do Wi-Fi. Sempre oferecer QR/URL com IP e diagnóstico de isolamento de clientes/firewall. Colisão de nomes deve gerar outro nome e atualizar o QR. [RFC 6762](https://www.rfc-editor.org/rfc/rfc6762.html).

`louva.show` é nome DNS convencional: exige controle do domínio e configuração DNS apropriada. O aplicativo não pode reservar esse endereço automaticamente em todas as igrejas. Um domínio controlado com resolução local pode ser opção avançada.

HTTPS confiável e endereço estável precisam ser resolvidos antes de entregar sessões pessoais persistentes. Rede local não torna HTTP criptografado. HTTP em outro computador também não é a exceção localhost dos navegadores. Instalação PWA/offline via service worker depende de contexto seguro. Não orientar a ignorar alertas de certificado; prever instalação administrada de confiança ou domínio/certificado adequado, e um modo inicial de consulta limitada quando só houver HTTP. [Contextos seguros](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts), [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

## Fotos

Iniciais e foto local funcionam offline. Gravatar é opcional: solicitar imagem pelo SHA-256 do e-mail normalizado, com autorização de uso externo, tamanho/tipo limitados e cache local. Hash não equivale a anonimização nem comprova identidade. Sem foto ou sem internet, usar iniciais sem bloquear cadastro. Não importar dados adicionais do perfil automaticamente. [Gravatar: hashes](https://docs.gravatar.com/rest/hash/), [imagens](https://docs.gravatar.com/sdk/images/).

## Colaboração e persistência

Entidades propostas, com UUIDs e migrações aditivas:

| Entidade | Responsabilidade |
| --- | --- |
| Member / MemberRole | Perfil e funções locais |
| DeviceSession / PairingRequest | Acesso, dispositivo, revogação e pareamento |
| ChordArrangement | Song de origem, proprietário, nome, escopo e procedência |
| ArrangementRevision | Documento estruturado imutável, tom base, revisão da letra e autoria |
| Seções, linhas, âncoras e sequência | Dentro do documento versionado; IDs estáveis, sem tabelas artificiais por caractere |
| Setlist / SetlistItem | Evolução dos repertórios atuais com escopo/proprietário e revisão da cifra por ocorrência |
| MemberChartPreferences | Capo, apresentação, notas pessoais e preferências sem alterar versão comum |

Repertórios atuais migram para escopo da igreja, sem mudar sua seleção ao vivo. Repertório pessoal nunca usa a preferência global de repertório selecionado do operador. Consultas validam propriedade no backend.

Salvar envia revisão de origem. Conflito preserva ambos os conteúdos e oferece comparar/copiar/criar variante; não sobrescrever silenciosamente. Publicar para a igreja mantém autoria e vínculo com a variante original; recomendação inicial é aprovação pelo operador. Músicos confiáveis podem ganhar permissão para publicar diretamente.

Repertórios preparados fixam uma revisão: uma publicação nova não muda a cifra durante o culto. Atualizar é explícito. Usar chaves de operação para repetição de pedidos após perda de conexão sem duplicar itens/publicações. Exportar backup de conteúdo não inclui sessões, chave Groq ou outros segredos.

## Importação de Cifra Club

Planejar um adaptador separado, com URL, prévia de metadados/letra/acordes, revisão do alinhamento e gravação explícita. Preservar origem, autor e créditos. Importação não publica automaticamente para a igreja.

A pesquisa confirmou recursos de versões pessoais, troca de tom e preferências de leitura no [blog oficial](https://www.cifraclub.com.br/blog/nova-tela-de-cifras/). Isso orienta necessidades de uso, não autoriza copiar a interface ou reutilizar o catálogo. Na consulta direta, a página de [termos oficiais](https://www.cifraclub.com.br/aviso-legal.html) respondeu HTTP 403; não foi confirmada uma API pública nem autorização para captura e redistribuição automatizadas. Não prometer importação irrestrita ou contornar bloqueios.

Primeiro caminho executável: criar com letra já cadastrada e importar/colar ChordPro ou texto autorizado. Importação de URL entra após confirmar um método permitido e testar páginas reais. Se aprovada, buscar só hosts/protocolos permitidos, com limite de tamanho/tempo, redirecionamentos revalidados e bloqueio de destinos locais/privados (SSRF). Conteúdo recebido vira texto/dados, nunca HTML executável.

## Sequência de implementação e aceite

1. Editor/viewer local: múltiplas versões por música, herdar letra, âncoras, seções repetidas, desfazer, rascunho e revisões. Validar teclado/toque e letras com acentos em desktop/tablet/celular antes de expandir.
2. Motor musical: tom confirmado, transposição, inversões, enarmonia, capo 0–5 e sugestões locais. Testes garantem equivalência sonora em todas as 12 alturas e nenhum símbolo desconhecido alterado silenciosamente.
3. Intercâmbio e repertório: ChordPro, versão/tom por ocorrência, duplicatas, revisão fixada e exportação sem segredos. Confirmar roundtrip com outro leitor real.
4. Equipe na LAN: HTTPS/endereço, servidor opt-in, perfis, pareamento, revogação, repertórios pessoais, viewer responsivo e presença. Testar dois músicos, dois dispositivos do mesmo músico, isolamento de dados, desligamento e reconexão mantendo a projeção.
5. Colaboração: variantes pessoais, publicação/aprovação, comparação de revisões e conflitos de edição. Dois painéis independentes e preferências por instrumento.
6. Integrações opcionais: Gravatar e Groq com consentimento, chaves protegidas, limites e fallback; ditado em campos compatíveis e sugestão de divisões com os switches independentes; importação de URL somente com método autorizado.

Para Groq, criar conjunto de casos sintéticos e revisão por músico: tom real, capo limite, inversões, menor/maior, ausência de boa alternativa, afinação não suportada, resposta inconsistente e falta de rede. A qualidade das explicações será avaliada; correção tonal é sempre validada pelo motor local. Aprovar JSON ou obter HTTP 200 não comprova competência musical.

Para ditado/organização, testar matriz de switches, permissão negada, navegador sem HTTPS, cancelamento, silêncio, troca de campo, edição durante a resposta, revisão antiga, preservação integral das palavras e ausência de alterações na sessão ao vivo.
