
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;


#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        

        // Create pgcrypto extension
        manager
            .get_connection()
            .execute_unprepared("CREATE EXTENSION IF NOT EXISTS pgcrypto")
            .await?;

        // Create update_last_updated_column function
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE OR REPLACE FUNCTION update_last_updated_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.last_updated = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                "#,
            )
            .await?;

        // Create table workflows (without foreign keys)
        manager
            .create_table(
                Table::create()
                    .table(Workflow::Table)
                    .if_not_exists()
                    .col(pk_auto(Workflow::Id))
                    .col(timestamp(Workflow::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp(Workflow::LastUpdated).default(Expr::current_timestamp()))
                    .col(boolean(Workflow::Active).not_null())
                    .col(string(Workflow::DefinitionJson).not_null())
                    .col(string(Workflow::Description).null())
                    .col(string(Workflow::Name).not_null())
                    .col(integer(Workflow::Version).not_null())
                    .to_owned(),
            )
            .await?;

        // Create trigger for workflows
        manager
            .get_connection()
            .execute_unprepared(&format!(
                r#"
                DROP TRIGGER IF EXISTS set_last_updated ON {schema}.{table};
                CREATE TRIGGER set_last_updated
                    BEFORE UPDATE ON {schema}.{table}
                    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();
                "#,
                schema = "public",
                table = "workflows",
            ))
            .await?;

        // Now add all foreign key constraints (after all tables exist)
        // Create many-to-many junction tables
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop many-to-many junction tables first
        // Drop foreign keys first (in reverse order)
        // Drop entity tables in reverse order
        manager
            .drop_table(Table::drop().table(Workflow::Table).to_owned())
            .await?;
        Ok(())
    }
}

// Define Iden enums for tables and columns
#[derive(DeriveIden)]
#[sea_orm(iden = "workflows")]
enum Workflow {
    #[sea_orm(iden = "workflows")]
    Table,
    Id,
    #[sea_orm(iden = "created_at")]
    CreatedAt,
    #[sea_orm(iden = "last_updated")]
    LastUpdated,
    #[sea_orm(iden = "active")]
    Active,
    #[sea_orm(iden = "definition_json")]
    DefinitionJson,
    #[sea_orm(iden = "description")]
    Description,
    #[sea_orm(iden = "name")]
    Name,
    #[sea_orm(iden = "version")]
    Version,
    }

// Define Iden enums for junction tables
