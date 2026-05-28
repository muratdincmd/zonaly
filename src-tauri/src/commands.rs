use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinSet;

use crate::rdap::RdapClient;
use crate::types::DomainQuery;

#[tauri::command]
pub async fn check_domains(
    app: AppHandle,
    state: State<'_, Arc<RdapClient>>,
    queries: Vec<DomainQuery>,
) -> Result<(), String> {
    let client = state.inner().clone();
    let mut set: JoinSet<()> = JoinSet::new();

    for query in queries {
        let client = client.clone();
        let app = app.clone();
        set.spawn(async move {
            let _permit = client.semaphore.clone().acquire_owned().await.ok();
            let result = client.check(&query).await;
            if let Err(e) = app.emit("domain-result", &result) {
                eprintln!("emit domain-result failed: {e}");
            }
        });
    }

    while set.join_next().await.is_some() {}

    if let Err(e) = app.emit("domain-results-complete", ()) {
        eprintln!("emit complete failed: {e}");
    }
    Ok(())
}
