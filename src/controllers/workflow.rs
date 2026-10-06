use crate::app_state::AppState;
use crate::models::workflow::{
    Column, Entity, Model, WorkflowCreate, WorkflowResponse, WorkflowUpdate,
};
use crate::ows::{normalize_ows_json, parse_ows_document};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, IntoActiveModel, PaginatorTrait,
    QueryFilter, QueryOrder, QuerySelect, Set,
};
use serde::Deserialize;
use tracing::debug;
use validator::Validate;
/// Maximum number of items per page (hard cap).
const MAX_PAGE_SIZE: u64 = 100;

/// Pagination and filtering query parameters for list endpoints.
#[derive(Debug, Deserialize)]
pub struct ListParams {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_page_size")]
    pub page_size: u64,
    /// Case-insensitive substring search on the primary name/title field.
    pub search: Option<String>,
    /// Sort field: `id`, `created_at` (default), or `last_updated`.
    pub sort: Option<String>,
    /// Sort direction: `asc` or `desc` (default).
    pub order: Option<String>,
}
fn default_page() -> u64 {
    1
}
fn default_page_size() -> u64 {
    25
}

async fn load_item<C>(db: &C, item_id: i32) -> Result<Model, (StatusCode, Json<serde_json::Value>)>
where
    C: ConnectionTrait,
{
    debug!("Loading workflow with id: {}", item_id);
    Entity::find_by_id(item_id)
        .one(db)
        .await
        .map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()})))
        })?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "not found"}))))
}
pub async fn list(
    State(state): State<AppState>, Query(params): Query<ListParams>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    debug!("Fetching list of workflows");
    let page_size = params.page_size.clamp(1, MAX_PAGE_SIZE);
    let page = params.page.max(1);
    let offset = (page.saturating_sub(1)) * page_size;

    let total = if let Some(ref s) = params.search {
        Entity::find().filter(Column::Name.contains(s.as_str())).count(&state.db).await.map_err(
            |e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": e.to_string()})),
                )
            },
        )?
    } else {
        Entity::find().count(&state.db).await.map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()})))
        })?
    };
    let mut q = Entity::find();
    if let Some(ref s) = params.search {
        q = q.filter(Column::Name.contains(s.as_str()));
    }
    let sort_column = match params.sort.as_deref() {
        Some("name") => Column::Name,
        Some("active") => Column::Active,
        Some("definition_json") => Column::DefinitionJson,
        Some("description") => Column::Description,
        Some("version") => Column::Version,
        Some("created_at") => Column::CreatedAt,
        Some("last_updated") => Column::LastUpdated,
        _ => Column::Id,
    };
    q = if params.order.as_deref() == Some("desc") {
        q.order_by_desc(sort_column)
    } else {
        q.order_by_asc(sort_column)
    };
    q = q.order_by_asc(Column::Id);
    let models = q.limit(page_size).offset(offset).all(&state.db).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()})))
    })?;

    debug!("Loaded {} workflows", models.len());
    let responses: Vec<WorkflowResponse> = models.into_iter().map(Into::into).collect();

    let count = responses.len() as u64;
    let start: u64 = offset;
    let end: u64 = if count == 0 { start } else { start + count - 1 };
    let mut headers = HeaderMap::new();
    let content_range_value = format!("items {}-{}/{}", start, end, total);
    if let Ok(val) = HeaderValue::from_str(&content_range_value) {
        headers.insert("Content-Range", val);
    }
    headers.insert("Accept-Ranges", HeaderValue::from_static("items"));
    Ok((StatusCode::OK, headers, Json(responses)))
}

pub async fn create(
    State(state): State<AppState>, Json(create): Json<WorkflowCreate>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    create.validate().map_err(|e| {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": e.to_string()})))
    })?;
    let mut create = create;
    create.definition_json = normalize_ows_json(&create.definition_json)
        .map_err(|error| ows_error(StatusCode::UNPROCESSABLE_ENTITY, error))?;
    debug!("Creating new OWS workflow - Request: {:?}", create);

    let active_model = create.into_active_model();
    let model = active_model.insert(&state.db).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()})))
    })?;
    debug!("Created workflow with id: {:?}", model.id);
    let resp: WorkflowResponse = model.into();
    Ok((StatusCode::CREATED, Json(resp)))
}

pub async fn update(
    State(state): State<AppState>, Path(item_id): Path<i32>, Json(update): Json<WorkflowUpdate>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    update.validate().map_err(|e| {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": e.to_string()})))
    })?;
    let mut update = update;
    update.definition_json = normalize_ows_json(&update.definition_json)
        .map_err(|error| ows_error(StatusCode::UNPROCESSABLE_ENTITY, error))?;
    debug!("Updating OWS workflow with id: {}", item_id);

    let _ = load_item(&state.db, item_id).await?;
    let mut active_model = update.into_active_model();
    active_model.id = Set(item_id);
    let model = active_model.update(&state.db).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()})))
    })?;
    debug!("Successfully updated workflow with id: {}", item_id);
    let resp: WorkflowResponse = model.into();
    Ok(Json(resp))
}

pub async fn remove(
    State(state): State<AppState>, Path(item_id): Path<i32>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    debug!("Deleting workflow with id: {}", item_id);

    let model = load_item(&state.db, item_id).await?;
    model.into_active_model().delete(&state.db).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()})))
    })?;
    debug!("Successfully deleted workflow with id: {}", item_id);
    Ok(StatusCode::NO_CONTENT)
}

pub async fn read_one(
    State(state): State<AppState>, Path(item_id): Path<i32>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    debug!("Fetching workflow with id: {}", item_id);

    let model = load_item(&state.db, item_id).await?;
    debug!("Successfully fetched workflow with id: {}", item_id);
    let resp: WorkflowResponse = model.into();
    Ok(Json(resp))
}

#[derive(Debug, Deserialize)]
pub struct ValidateRequest {
    pub definition_json: String,
}

/// Validate an OWS document without persisting it. This powers the editor's
/// validate action and gives API clients a stable validation contract.
pub async fn validate_ows(
    Json(request): Json<ValidateRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    match parse_ows_document(&request.definition_json) {
        Ok(definition) => Ok(Json(serde_json::json!({
            "valid": true,
            "definition": definition,
        }))),
        Err(error) => Ok(Json(serde_json::json!({
            "valid": false,
            "errors": [{ "message": error }],
        }))),
    }
}

fn ows_error(status: StatusCode, message: String) -> (StatusCode, Json<serde_json::Value>) {
    (
        status,
        Json(serde_json::json!({
            "error": message,
            "code": "invalid_ows_definition",
        })),
    )
}

pub fn routes() -> axum::Router<AppState> {
    use axum::routing::get;
    let router = axum::Router::new()
        .route("/api/workflows", get(list).post(create))
        .route("/api/workflows/validate", axum::routing::post(validate_ows))
        .route("/api/workflows/{id}", get(read_one).put(update).delete(remove));

    router
}
