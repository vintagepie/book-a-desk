import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

// Wrap the Express app using serverless-http
export const handler = serverless(app);
