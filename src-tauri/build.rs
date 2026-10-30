fn main() {
    embed_bibles();
    let mut attributes = tauri_build::Attributes::new();
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        // The resource manifest alone does not reach Cargo's library test harness.
        // Native dialogs import TaskDialogIndirect, which requires Common Controls v6.
        // Embed the same manifest through the linker for both application and tests.
        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
        let manifest = std::path::PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("Diretório Cargo ausente"),
        )
        .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
    tauri_build::try_build(
        attributes.app_manifest(tauri_build::AppManifest::new().commands(&[
            "get_update_state",
            "check_for_updates",
            "download_update",
            "install_update",
            "list_charts",
            "get_chart",
            "create_chart_document",
            "save_chart",
            "delete_chart",
            "list_chart_revisions",
            "import_chart",
            "export_chart",
            "export_chart_file",
            "transpose_chart",
            "suggest_chart_capos",
            "suggest_chart_keys",
            "publish_chart",
            "document_import_config",
            "document_import_save_config",
            "document_import_set_key",
            "document_import_remove_key",
            "import_chart_document",
            "assistant_config",
            "assistant_save_config",
            "assistant_set_key",
            "assistant_remove_key",
            "assistant_split",
            "assistant_transcribe",
            "assistant_rank_capo",
            "team_interfaces",
            "team_status",
            "team_start",
            "team_stop",
            "team_refresh_avatar",
            "team_users",
            "team_save_user",
            "team_devices",
            "team_approve_device",
            "team_revoke_device",
            "get_startup_state",
            "mark_operator_ready",
            "mark_operator_failed",
            "retry_startup",
            "complete_startup",
            "close_startup",
            "list_bible_versions",
            "list_bible_books",
            "get_bible_chapter",
            "open_community_group",
            "open_author_website",
            "open_author_contact",
            "list_categories",
            "create_category",
            "rename_category",
            "bulk_set_category",
            "bulk_song_usage",
            "bulk_delete_songs",
            "preview_import",
            "import_songs",
            "export_songs",
            "get_snapshot",
            "presentation_action",
            "list_monitors",
            "open_projection",
            "projection_fullscreen",
            "projection_status",
            "list_songs",
            "save_song",
            "delete_song",
            "song_usage",
            "get_setlist",
            "list_setlists",
            "select_setlist",
            "create_setlist",
            "rename_setlist",
            "delete_setlist",
            "add_setlist_item",
            "remove_setlist_item",
            "reorder_setlist",
        ])),
    )
    .expect("Falha ao configurar permissões");
}

fn embed_bibles() {
    use std::{
        collections::BTreeSet,
        env, fs,
        path::{Component, PathBuf},
    };
    let root = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("Diretório Cargo ausente"));
    let resource_root = root.join("resources/bibles");
    assert!(
        !fs::symlink_metadata(root.join("resources"))
            .expect("Diretório de recursos ausente")
            .file_type()
            .is_symlink(),
        "O diretório de recursos não pode ser link simbólico"
    );
    let manifest_path = resource_root.join("manifest.json");
    println!("cargo:rerun-if-changed={}", manifest_path.display());
    assert!(
        !fs::symlink_metadata(&resource_root)
            .expect("Recursos bíblicos ausentes")
            .file_type()
            .is_symlink(),
        "O diretório bíblico não pode ser link simbólico"
    );
    assert!(
        !fs::symlink_metadata(&manifest_path)
            .expect("Manifesto bíblico ausente")
            .file_type()
            .is_symlink(),
        "O manifesto não pode ser link simbólico"
    );
    let manifest: serde_json::Value = serde_json::from_slice(
        &fs::read(&manifest_path).expect("Não foi possível ler manifesto bíblico"),
    )
    .expect("Manifesto bíblico JSON inválido");
    let versions = manifest
        .as_array()
        .expect("Manifesto bíblico deve ser uma lista");
    assert!(!versions.is_empty(), "Manifesto bíblico vazio");
    let canonical_root = resource_root
        .canonicalize()
        .expect("Não foi possível resolver diretório bíblico");
    assert!(
        canonical_root.starts_with(root.canonicalize().expect("Diretório do projeto inválido")),
        "Recursos bíblicos fora do projeto"
    );
    let mut files = BTreeSet::new();
    for version in versions {
        for book in version["books"]
            .as_array()
            .expect("Lista de livros ausente")
        {
            let file = book["file"].as_str().expect("Caminho de livro ausente");
            let relative = PathBuf::from(file);
            assert!(
                !relative.as_os_str().is_empty()
                    && !file.contains('\\')
                    && relative.extension().is_some_and(|ext| ext == "json"),
                "Caminho de livro inválido"
            );
            let mut cursor = resource_root.clone();
            for component in relative.components() {
                let Component::Normal(segment) = component else {
                    panic!("O caminho bíblico deve ser relativo, sem ..");
                };
                cursor.push(segment);
                assert!(
                    !fs::symlink_metadata(&cursor)
                        .expect("Arquivo bíblico declarado ausente")
                        .file_type()
                        .is_symlink(),
                    "Links simbólicos não são permitidos nos recursos bíblicos"
                );
            }
            let path = cursor
                .canonicalize()
                .expect("Não foi possível resolver livro bíblico");
            assert!(
                path.starts_with(&canonical_root) && path.is_file(),
                "Livro fora do diretório autorizado"
            );
            assert!(
                fs::metadata(&path)
                    .expect("Metadados do livro indisponíveis")
                    .len()
                    < 5 * 1024 * 1024,
                "Livro excede 5 MiB"
            );
            println!("cargo:rerun-if-changed={}", path.display());
            files.insert((file.to_owned(), path));
        }
    }
    let mut generated=format!("const BIBLE_MANIFEST: &str = include_str!({:?});\nconst BIBLE_BOOK_FILES: &[(&str,&str)] = &[\n",manifest_path);
    for (file, path) in files {
        generated.push_str(&format!("({file:?}, include_str!({path:?})),\n"));
    }
    generated.push_str("];\n");
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR ausente")).join("embedded_bibles.rs"),
        generated,
    )
    .expect("Não foi possível gerar índice bíblico embutido");
}
