# Importação de documentos · 0.7.0

A importação cria uma proposta de cifra. **Usar esta cifra** substitui o rascunho; **Salvar cifra** grava a revisão. Nenhuma extração altera a letra da biblioteca ou a saída projetada.

## Formatos

| Entrada | Processamento no LouvaShow |
| --- | --- |
| Texto colado e TXT | Local, com acordes acima da letra. Não exige chave nem internet. |
| ChordPro | Local; formatos `.cho`, `.chopro`, `.chordpro` e `.pro`. |
| DOCX | Texto extraído localmente; interpretação por IA opcional no desktop. |
| PDF | Interpretação por Gemini ou OpenAI, após configuração e confirmação. |
| DOC antigo, binário | Interpretação por OpenAI. Para usar Gemini, converta para PDF, DOCX ou TXT. |

O botão de arquivos aceita até **12 MiB** por documento. PDFs precisam ter entre **1 e 20 páginas**, não podem ser criptografados e passam por validação antes do envio. São limites do LouvaShow, mesmo quando o provedor aceita documentos maiores. Textos extraídos também têm limites de tamanho; se houver recusa, divida o documento.

A extração local de DOCX preserva texto, quebras e tabulações, mas não reproduz imagens, cabeçalhos, rodapés nem todo o leiaute. Tabelas são convertidas em texto com tabulações. Se a posição visual dos acordes depender de caixas de texto ou imagens, exporte o original como PDF e revise o resultado da interpretação. O processamento de PDF pode interpretar páginas digitalizadas, mas não garante leitura correta de fotografias, símbolos pequenos ou páginas mal digitalizadas. A documentação dos serviços descreve [a interpretação visual de PDF pelo Gemini](https://ai.google.dev/gemini-api/docs/document-processing) e [as diferenças entre PDF e outros arquivos na OpenAI](https://developers.openai.com/api/docs/guides/file-inputs).

A colagem de conteúdo autorizado do Cifra Club usa **Colar cifra → Revisar colagem**. Não existe importação por URL na versão 0.7.0.

## Configurar IA no desktop

1. Em **Configurações → Assistente IA**, abra **Documentos · OpenAI e Gemini**.
2. Guarde a chave do serviço desejado. As chaves ficam no cofre de credenciais do sistema operacional; não são gravadas no banco de cifras nem entregues aos navegadores da equipe.
3. Marque **Habilitar importação com IA**, escolha o provedor/modelo e clique em **Salvar preferências**.
4. No editor, selecione **Importar documento**. Para DOCX, escolha se deseja **Extrair com IA**; PDF e DOC antigo precisam dessa opção.
5. Clique em **Extrair e revisar** e confirme o envio. Compare o texto, os acordes, suas posições e as partes com o original antes de aplicar.

A integração começa desligada. **Remover chave** apaga a credencial daquele provedor neste computador. A chave não é exibida novamente no formulário. Os serviços exigem internet e acesso à API correspondente; uma assinatura de aplicativo de conversa não deve ser presumida como crédito de API.

## Modelos e escolha do serviço

| Provedor | Modelo configurado nesta versão | Escolha |
| --- | --- | --- |
| Gemini | `gemini-3.8-flash` | Padrão do Gemini. |
| Gemini | `gemini-3.5-flash-lite` | Alternativa econômica, selecionada pelo operador. |
| OpenAI | `gpt-5.4-mini` | Modelo fixo da integração OpenAI. |

Os identificadores constam do [catálogo oficial Gemini](https://ai.google.dev/gemini-api/docs/models) e da [página oficial GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), consultados em 30/10/2026. Disponibilidade e condições de acesso podem mudar. O LouvaShow ainda não mediu a qualidade de extração com documentos reais nesses modelos.

Ao escolher **Automático** na importação, o programa usa o provedor padrão salvo nas configurações. Se esse padrão também for **Automático**, usa Gemini quando houver uma chave disponível; caso contrário, usa OpenAI. DOC antigo exige OpenAI. Se Gemini estiver escolhido explicitamente para DOC, a importação pede conversão ou troca de provedor.

Uma escolha explícita é respeitada: faltar uma chave, exceder uma cota, ocorrer uma recusa ou falhar a rede gera erro. **Não há troca automática de serviço após a falha.** Você decide se tenta novamente, muda o provedor ou usa um formato local.

## Dados enviados e custos

PDF e DOC são enviados como arquivo ao serviço escolhido. Para DOCX interpretado por IA, o programa envia o texto extraído localmente, não as imagens do documento. A autorização é solicitada antes do envio; cancelar a confirmação não inicia a extração externa. Os termos de retenção e uso de dados são os do provedor e da conta utilizada.

O LouvaShow não cobra pela importação. Chamadas externas podem consumir créditos da sua conta; o custo varia com modelo, quantidade de páginas, texto e resposta produzida. Consulte os [preços da API Gemini](https://ai.google.dev/gemini-api/docs/pricing) e os [preços da API OpenAI](https://developers.openai.com/api/docs/pricing). A opção Flash-Lite é econômica, mas não há garantia de valor por música nem de resultado equivalente em todo documento.

## Revisão e falhas

- Confira acentos, linhas omitidas, acordes com baixo, extensões, posição sobre as sílabas e repetições de partes.
- Leia os avisos e as observações da proposta. O modelo pode errar mesmo quando o arquivo é aceito.
- **Cancelar importação** conserva a cifra anterior. A proposta só entra no rascunho após **Usar esta cifra**.
- Se editar o texto colado depois da revisão, execute **Revisar colagem** novamente.
- Após aplicar, ajuste as faixas no editor e clique em **Salvar cifra**. Em conflito de revisão, preserve o rascunho como uma nova versão pessoal.

A implementação tem verificações automatizadas de formatos, limites, seleção de provedor e validação das propostas. **Chamadas reais à OpenAI e ao Gemini não foram validadas nesta implementação.** A documentação das APIs não substitui esse teste, nem comprova a qualidade de extração de um documento específico.
