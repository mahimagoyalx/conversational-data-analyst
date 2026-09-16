import type { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

export function mountApiDocs(router: Router): void {
  router.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  router.use(
    "/docs",
    ...swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Conversational Data Analyst API",
      swaggerOptions: {
        persistAuthorization: false,
      },
    }),
  );
}
