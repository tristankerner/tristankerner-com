use actix_files::{Files, NamedFile};
use actix_web::{web, App, HttpServer, Result};

async fn index() -> Result<NamedFile> {
    // Serves the entry point of your Svelte SPA
    Ok(NamedFile::open("./frontend/build/index.html")?)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            // 1. Place your API routes BEFORE frontend asset services
            .service(web::scope("/api"))

            // 2. Serve static assets (JS, CSS, Images) from the build folder
            .service(Files::new("/", "./frontend/build")
                         .index_file("index.html")
                         .default_handler(web::route().to(index))
                     // TODO: try_compressed() should be available for next release?
                     // Handles Svelte client routing fixes
            )
    })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}