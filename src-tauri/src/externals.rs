//! Explicit, bounded import of a public Cifra Club page. No cookies, browser
//! impersonation, authenticated content or anti-bot bypass is used.
use crate::domain::charts::ChartImportResult;
use scraper::{Html, Node, Selector};
use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    time::Duration,
};

fn approved_url(input: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(input.trim())
        .map_err(|_| "Informe uma URL HTTPS válida do Cifra Club.")?;
    if url.scheme() != "https"
        || !matches!(
            url.host_str(),
            Some("www.cifraclub.com.br" | "cifraclub.com.br")
        )
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port_or_known_default() != Some(443)
        || url.path().split('/').filter(|v| !v.is_empty()).count() < 2
    {
        return Err("Use o endereço HTTPS público de uma música em cifraclub.com.br, sem credenciais ou porta alternativa.".into());
    }
    Ok(url)
}
fn public_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_multicast()
        || ip.is_broadcast()
        || a == 0
        || a >= 240
        || (a == 100 && (64..=127).contains(&b))
        || (a == 192 && b == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
        || (a == 203 && b == 0 && c == 113))
}
fn parse_page(html: &str, source: &str) -> Result<ChartImportResult, String> {
    let page = Html::parse_document(html);
    let selector =
        Selector::parse("pre").map_err(|_| "Não foi possível ler o formato da página.")?;
    let pre = page.select(&selector).max_by_key(|pre|pre.text().map(str::len).sum::<usize>())
        .ok_or("A página não disponibilizou a cifra em texto. Cole uma cifra autorizada ou importe ChordPro.")?;
    let mut text = String::new();
    for node in pre.descendants() {
        if node.ancestors().any(|ancestor|matches!(ancestor.value(),Node::Element(el) if matches!(el.name(), "script" | "style"))) {continue;}
        match node.value() {
            Node::Text(value) => text.push_str(value),
            Node::Element(value) if value.name() == "br" => text.push('\n'),
            _ => {}
        }
    }
    if text.trim().is_empty() {
        return Err("A página não disponibilizou uma cifra legível.".into());
    }
    let mut result = crate::application::charts::import_text(&text)?;
    if let Ok(selector) = Selector::parse("h1") {
        if let Some(title) = page.select(&selector).next() {
            let title = title.text().collect::<String>();
            if !title.trim().is_empty() && title.chars().count() <= 200 {
                result.document.title = title.trim().into();
            }
        }
    }
    result.document.notes = format!("Origem: {source}\nImportação pessoal: confira autoria, créditos e autorização antes de compartilhar.");
    result.warnings.push("Confira tom, capotraste, seções e alinhamento antes de salvar. A página pode conter elementos não suportados.".into());
    Ok(result)
}
#[tauri::command]
pub async fn import_chart_url(
    window: tauri::WebviewWindow,
    url: String,
) -> Result<ChartImportResult, String> {
    crate::commands::operator(&window)?;
    let url = approved_url(&url)?;
    let host = url.host_str().ok_or("Endereço inválido")?.to_string();
    let addresses: Vec<SocketAddr> = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::net::lookup_host((host.as_str(), 443)),
    )
    .await
    .map_err(|_| "Tempo esgotado ao localizar o Cifra Club.")?
    .map_err(|_| "Não foi possível localizar o Cifra Club. Confira a conexão.")?
    .filter(|addr| matches!(addr.ip(),IpAddr::V4(ip) if public_ipv4(ip)))
    .collect();
    if addresses.is_empty() {
        return Err("O site não resolveu para um endereço público permitido.".into());
    }
    let client = reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(25))
        .resolve_to_addrs(&host, &addresses)
        .user_agent("LouvaShow/0.6 (https://github.com/dantetesta/LouvaShow)")
        .build()
        .map_err(|_| "Não foi possível preparar a importação")?;
    let response = client.get(url.clone()).send().await.map_err(|_| {
        "Não foi possível consultar a página. Confira a internet ou cole o texto autorizado."
    })?;
    if response.status().as_u16() == 403 || response.status().as_u16() == 429 {
        return Err("O Cifra Club bloqueou ou limitou a consulta automática. Nenhum bloqueio foi contornado. Use a importação por texto autorizado ou ChordPro.".into());
    }
    if response.status().is_redirection() {
        return Err(
            "O site redirecionou a consulta. Confira e informe o endereço final público da música."
                .into(),
        );
    }
    if !response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("text/html"))
    {
        return Err("O site não retornou uma página HTML de cifra.".into());
    }
    let bytes = crate::assistant::bounded(response, 2 * 1024 * 1024).await?;
    let html = String::from_utf8(bytes)
        .map_err(|_| "A página usa uma codificação não suportada. Cole o texto autorizado.")?;
    tauri::async_runtime::spawn_blocking(move || parse_page(&html, url.as_str()))
        .await
        .map_err(|_| "Não foi possível interpretar a cifra recebida.".to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn urls_and_network_destinations_are_restricted() {
        assert!(approved_url("https://www.cifraclub.com.br/artista/musica/").is_ok());
        for url in [
            "http://www.cifraclub.com.br/a/b/",
            "https://127.0.0.1/a/b",
            "https://cifraclub.com.br.evil.test/a/b",
            "https://user@cifraclub.com.br/a/b",
            "https://cifraclub.com.br:444/a/b",
        ] {
            assert!(approved_url(url).is_err());
        }
        assert!(!public_ipv4(Ipv4Addr::new(127, 0, 0, 1)));
        assert!(!public_ipv4(Ipv4Addr::new(10, 0, 0, 1)));
        assert!(public_ipv4(Ipv4Addr::new(8, 8, 8, 8)));
    }
    #[test]
    fn only_text_and_line_breaks_are_imported() {
        let result = parse_page(
            "<h1>Exemplo próprio</h1><pre><b>D</b>       <b>G</b><br>Frase de exemplo</pre>",
            "https://www.cifraclub.com.br/a/b/",
        )
        .unwrap();
        assert_eq!(result.document.title, "Exemplo próprio");
        assert!(result
            .document
            .sections
            .iter()
            .flat_map(|s| &s.lines)
            .any(|line| line.text.contains("Frase de exemplo")));
        assert!(parse_page("<html>blocked</html>", "source").is_err());
    }
}
