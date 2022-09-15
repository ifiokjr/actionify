import { createEnv } from "./utils.ts";

export const env = createEnv([
  "BACKBLAZE_SECRET",
  "BACKBLAZE_ID",
  "BACKBLAZE_BUCKET_NAME",
  "BACKBLAZE_BUCKET_ID",
]);
