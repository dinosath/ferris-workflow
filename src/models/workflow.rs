use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use validator::Validate;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveEntityModel)]
#[sea_orm(table_name = "workflows")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub created_at: DateTime,
    pub last_updated: DateTime,
    pub active: bool,
    pub definition_json: String,
    pub description: Option<String>,
    pub name: String,
    pub version: i32,
}

impl ActiveModelBehavior for ActiveModel {}

/// Create struct — fields that the caller supplies; timestamps are auto-set by the server.
#[derive(Clone, Debug, Default, Deserialize, Serialize, DeriveIntoActiveModel, Validate)]
#[sea_orm(
    active_model = "ActiveModel",
    set(created_at = "chrono::Utc::now().naive_utc()"),
    set(last_updated = "chrono::Utc::now().naive_utc()")
)]
pub struct WorkflowCreate {
    #[serde(default)]
    pub active: bool,
    #[validate(length(min = 2))]
    pub definition_json: String,
    pub description: Option<String>,
    #[validate(length(min = 1))]
    pub name: String,
    #[serde(default = "default_version")]
    #[validate(range(min = 1))]
    pub version: i32,
}

/// Update struct — same writable fields as Create; `last_updated` is refreshed automatically.
#[derive(Clone, Debug, Default, Deserialize, Serialize, DeriveIntoActiveModel, Validate)]
#[sea_orm(active_model = "ActiveModel", set(last_updated = "chrono::Utc::now().naive_utc()"))]
pub struct WorkflowUpdate {
    #[serde(default)]
    pub active: bool,
    #[validate(length(min = 2))]
    pub definition_json: String,
    pub description: Option<String>,
    #[validate(length(min = 1))]
    pub name: String,
    #[serde(default = "default_version")]
    #[validate(range(min = 1))]
    pub version: i32,
}

fn default_version() -> i32 {
    1
}

/// Response struct — all readable fields returned to the client.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct WorkflowResponse {
    pub id: i32,
    pub created_at: DateTime,
    pub last_updated: DateTime,
    pub active: bool,
    pub definition_json: String,
    pub description: Option<String>,
    pub name: String,
    pub version: i32,
}

impl From<Model> for WorkflowResponse {
    fn from(model: Model) -> Self {
        Self {
            id: model.id,
            created_at: model.created_at,
            last_updated: model.last_updated,
            active: model.active,
            definition_json: model.definition_json,
            description: model.description,
            name: model.name,
            version: model.version,
        }
    }
}
