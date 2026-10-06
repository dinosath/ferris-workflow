pub mod proto {
    tonic::include_proto!("ferris_cms");
}

pub mod workflow;

use serde::{de::DeserializeOwned, Serialize};
use tonic::Status;

use crate::app_state::AppState;

const DEFAULT_PAGE_SIZE: u64 = 50;
const MAX_PAGE_SIZE: u64 = 1000;

/// Axum router serving every entity's gRPC service; merged into the REST router so both share a port.
pub fn router(state: &AppState) -> axum::Router {
    axum::Router::new()
        .route_service(workflow::ROUTE, workflow::server(state.db.clone()))
        }

pub fn page_size(requested: i32) -> u64 {
    match u64::try_from(requested) {
        Ok(0) | Err(_) => DEFAULT_PAGE_SIZE,
        Ok(n) => n.min(MAX_PAGE_SIZE),
    }
}

pub fn page_offset(token: &str) -> Result<u64, Status> {
    if token.is_empty() {
        Ok(0)
    } else {
        parse_str("page_token", token)
    }
}

pub fn invalid(field: &str, err: impl std::fmt::Display) -> Status {
    Status::invalid_argument(format!("invalid {field}: {err}"))
}

pub fn validation_error(err: validator::ValidationErrors) -> Status {
    Status::invalid_argument(err.to_string())
}

pub fn db_error(err: sea_orm::DbErr) -> Status {
    tracing::error!("database error: {err}");
    Status::internal("database error")
}

pub fn parse_id(field: &str, value: &str) -> Result<i32, Status> {
    parse_str(field, value)
}

pub fn parse_str<T>(field: &str, value: &str) -> Result<T, Status>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    value.parse().map_err(|e| invalid(field, e))
}

pub fn parse_int<T>(field: &str, value: i64) -> Result<T, Status>
where
    T: TryFrom<i64>,
    T::Error: std::fmt::Display,
{
    T::try_from(value).map_err(|e| invalid(field, e))
}

pub fn parse_datetime(field: &str, value: &str) -> Result<chrono::NaiveDateTime, Status> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.naive_utc())
        .or_else(|_| value.parse())
        .map_err(|e| invalid(field, e))
}

pub fn format_datetime(value: &chrono::NaiveDateTime) -> String {
    value.and_utc().to_rfc3339()
}

pub fn parse_enum<T: DeserializeOwned>(field: &str, value: String) -> Result<T, Status> {
    serde_json::from_value(serde_json::Value::String(value)).map_err(|e| invalid(field, e))
}

pub fn enum_to_string<T: Serialize>(value: &T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .unwrap_or_default()
}