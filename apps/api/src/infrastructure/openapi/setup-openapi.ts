import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupOpenApi(app: INestApplication, nodeEnv: string): void {
  const config = new DocumentBuilder()
    .setTitle("ERP API")
    .setDescription("Enterprise ERP HTTP API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const options =
    nodeEnv === "production" ? { swaggerOptions: { supportedSubmitMethods: [] } } : {};
  SwaggerModule.setup("api/docs", app, document, options);
}
