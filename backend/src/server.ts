import { buildApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db.js";

const start = async () => {
  await migrate();
  const app = buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
