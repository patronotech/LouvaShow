# Logos oficiais do LouvaShow

Estas são as quatro versões oficiais da identidade do LouvaShow. Os links abaixo abrem os arquivos PNG usados pelo projeto.

| Estilo | Uso visual indicado | Download do PNG |
| --- | --- | --- |
| Mestre roxo · modo claro | Interface e materiais de fundo claro | [Baixar mestre roxo · modo claro](https://raw.githubusercontent.com/dantetesta/LouvaShow/main/src/shared/assets/logo-light.png) |
| Lavanda · modo escuro | Interface e materiais de fundo escuro | [Baixar lavanda · modo escuro](https://raw.githubusercontent.com/dantetesta/LouvaShow/main/src/shared/assets/logo-dark.png) |
| Preta | Aplicação monocromática sobre fundo claro | [Baixar logo preta](https://raw.githubusercontent.com/dantetesta/LouvaShow/main/docs/brand/logo-black.png) |
| Branca | Aplicação monocromática sobre fundo escuro | [Baixar logo branca](https://raw.githubusercontent.com/dantetesta/LouvaShow/main/docs/brand/logo-white.png) |

O navegador pode exibir o PNG em vez de baixá-lo diretamente. Nesse caso, use **Salvar imagem como…**. A versão branca precisa de um fundo escuro para ser visualizada com contraste.

## Prévia adaptada ao tema

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../src/shared/assets/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="../src/shared/assets/logo-light.png">
  <img src="../src/shared/assets/logo-light.png" width="280" alt="Logo colorida oficial LouvaShow">
</picture>

O README e o aplicativo usam a versão colorida adequada ao fundo. No aplicativo, a escolha **Claro/Escuro** fica em **Configurações → Aparência** e é salva neste computador, sem modificar a saída de projeção.

## Retrato nos créditos

O retrato de Dante Testa usado nos créditos foi produzido a partir de uma referência fornecida pelo autor. O aplicativo incorpora somente o retrato final autorizado; a imagem original de referência não faz parte do código público.

## Introdução do aplicativo

A abertura usa o vídeo oficial fornecido pelo mantenedor, incorporado em `src/shared/assets/intro.mp4`: H.264, 1280 × 720, 24 quadros/s e 10 segundos. A cópia distribuída contém somente vídeo; a faixa de áudio e metadados dispensáveis foram removidos sem recodificar os quadros. `intro-poster.jpg` é o quadro estático de apoio.

A animação roda uma vez numa janela 16:9. Versão, autoria e indicação da situação da licença aparecem discretamente acima da barra inferior. A barra é indeterminada: ela indica atividade, sem inventar uma porcentagem de carregamento. A janela do operador só é exibida após terminar a animação e concluir a inicialização. A preferência de movimento reduzido usa imagem estática; falha de reprodução também permite continuar quando o aplicativo estiver pronto.

Esses dois arquivos têm hashes fixados na auditoria pública. Substituir o vídeo exige inspecionar novamente seu conteúdo e atualizar os hashes após a revisão. A referência original de Downloads não integra a distribuição.

## Uso dos arquivos

Preserve as proporções originais, a legibilidade e o contraste. Estes arquivos identificam o projeto; sua disponibilidade para download não estabelece uma licença de marca nem autoriza sugerir parceria ou endosso.

Não foi definida uma licença separada para as logos. A licença do código do software também permanece pendente de escolha pelo mantenedor. As licenças dos textos bíblicos e outros materiais de terceiros continuam independentes; consulte seus avisos próprios.

[Voltar ao README](../README.md)
