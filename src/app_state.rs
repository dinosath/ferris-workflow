use sea_orm::DatabaseConnection;

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
}

impl AppState {
    pub async fn new() -> Self {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432".to_string());
        let db =
            sea_orm::Database::connect(&database_url).await.expect("failed to connect to database");
        {
            use migration::MigratorTrait;
            migration::Migrator::up(&db, None).await.expect("seaorm migrations failed");
        }
        Self { db }
    }
}
