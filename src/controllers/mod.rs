mod health;
pub mod workflow;

use crate::app_state::AppState;
use axum::Router;

/// Returns a Router with all entity controllers and health endpoint merged.
pub fn routes() -> Router<AppState> {
    Router::new().route("/api/health", axum::routing::get(health::health)).merge(workflow::routes())
}
