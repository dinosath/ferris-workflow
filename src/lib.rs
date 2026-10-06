pub mod connect;
pub mod controllers;
pub mod models {
    automod::dir!(pub "src/models");
}
pub mod app_state;
pub mod ows;

use static_serve::embed_assets;

embed_assets!("frontend/dist", compress = true, strip_html_ext = true);
/// Build the axum [`Router`] with all routes and middleware.
pub fn build_router(state: app_state::AppState) -> axum::Router {
    use axum::http::HeaderValue;
    use axum::http::header;
    use tower_http::set_header::SetResponseHeaderLayer;

    let mut router = axum::Router::new();
    router = router.merge(controllers::routes());
    let connect_service = connect::service(controllers::routes().with_state(state.clone()));
    router = router.route_service(
        "/entities.v1.EntityService/Execute",
        connect_service.into_service::<axum::body::Body>(),
    );
    router = router.merge(static_router());
    // ─── Security headers (always applied) ──────────────────────────────
    router = router
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("x-xss-protection"),
            HeaderValue::from_static("1; mode=block"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("x-download-options"),
            HeaderValue::from_static("noopen"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ));

    router.with_state(state)
}
