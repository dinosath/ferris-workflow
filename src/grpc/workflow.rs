use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, IntoActiveModel, QueryOrder, QuerySelect, Set};
use tonic::{Request, Response, Status};
use validator::Validate;

use super::proto;
use crate::models::workflow::{Column, Entity, WorkflowCreate, WorkflowResponse, WorkflowUpdate};

pub struct WorkflowGrpcService {
    db: DatabaseConnection,
}

pub const ROUTE: &str = "/ferris_cms.WorkflowService/{*method}";

pub fn server(db: DatabaseConnection) -> proto::workflow_service_server::WorkflowServiceServer<WorkflowGrpcService> {
    proto::workflow_service_server::WorkflowServiceServer::new(WorkflowGrpcService { db })
}

fn to_proto(model: WorkflowResponse) -> proto::Workflow {
    proto::Workflow {
        id: model.id.to_string(),
        created_at: super::format_datetime(&model.created_at),
        updated_at: super::format_datetime(&model.last_updated),
        active: model.active,
        definition_json: model.definition_json,
        description: model.description,
        name: model.name,
        version: i64::from(model.version),
        
    }
}

fn create_from_proto(req: proto::CreateWorkflowRequest) -> Result<WorkflowCreate, Status> {
    Ok(WorkflowCreate {
        active: req.active,
        definition_json: req.definition_json,
        description: req.description,
        name: req.name,
        version: super::parse_int("version", req.version)?,
        })
}

fn update_from_proto(req: proto::UpdateWorkflowRequest) -> Result<WorkflowUpdate, Status> {
    Ok(WorkflowUpdate {
        active: req.active,
        definition_json: req.definition_json,
        description: req.description,
        name: req.name,
        version: super::parse_int("version", req.version)?,
        })
}

fn not_found(id: &str) -> Status {
    Status::not_found(format!("workflow {id} not found"))
}

#[tonic::async_trait]
impl proto::workflow_service_server::WorkflowService for WorkflowGrpcService {
    async fn create(
        &self,
        request: Request<proto::CreateWorkflowRequest>,
    ) -> Result<Response<proto::Workflow>, Status> {
        let input = create_from_proto(request.into_inner())?;
        input.validate().map_err(super::validation_error)?;
        let model = input
            .into_active_model()
            .insert(&self.db)
            .await
            .map_err(super::db_error)?;
        Ok(Response::new(to_proto(model.into())))
    }

    async fn get(
        &self,
        request: Request<proto::GetWorkflowRequest>,
    ) -> Result<Response<proto::Workflow>, Status> {
        let raw_id = request.into_inner().id;
        let id = super::parse_id("id", &raw_id)?;
        let model = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(super::db_error)?
            .ok_or_else(|| not_found(&raw_id))?;
        Ok(Response::new(to_proto(model.into())))
    }

    async fn update(
        &self,
        request: Request<proto::UpdateWorkflowRequest>,
    ) -> Result<Response<proto::Workflow>, Status> {
        let req = request.into_inner();
        let raw_id = req.id.clone();
        let id = super::parse_id("id", &raw_id)?;
        let input = update_from_proto(req)?;
        input.validate().map_err(super::validation_error)?;
        Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(super::db_error)?
            .ok_or_else(|| not_found(&raw_id))?;
        let mut active_model = input.into_active_model();
        active_model.id = Set(id);
        let model = active_model
            .update(&self.db)
            .await
            .map_err(super::db_error)?;
        Ok(Response::new(to_proto(model.into())))
    }

    async fn delete(
        &self,
        request: Request<proto::DeleteWorkflowRequest>,
    ) -> Result<Response<proto::Empty>, Status> {
        let raw_id = request.into_inner().id;
        let id = super::parse_id("id", &raw_id)?;
        let result = Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(super::db_error)?;
        if result.rows_affected == 0 {
            return Err(not_found(&raw_id));
        }
        Ok(Response::new(proto::Empty {}))
    }

    async fn list(
        &self,
        request: Request<proto::ListWorkflowsRequest>,
    ) -> Result<Response<proto::ListWorkflowsResponse>, Status> {
        let req = request.into_inner();
        let offset = super::page_offset(&req.page_token)?;
        let limit = super::page_size(req.page_size);
        let models = Entity::find()
            .order_by_asc(Column::Id)
            .offset(offset)
            .limit(limit)
            .all(&self.db)
            .await
            .map_err(super::db_error)?;
        let next_page_token = if models.len() as u64 == limit {
            (offset + limit).to_string()
        } else {
            String::new()
        };
        Ok(Response::new(proto::ListWorkflowsResponse {
            workflows: models.into_iter().map(|m| to_proto(m.into())).collect(),
            next_page_token,
        }))
    }
}