import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

export const b2Client = new S3Client({
  region: process.env.B2_REGION || "us-west-002",
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-west-002.backblazeb2.com",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

export const B2_BUCKET = process.env.B2_BUCKET_NAME;
// e.g. "https://<bucket>.s3.us-west-002.backblazeb2.com" (⚠️ no trailing slash)
export const B2_PUBLIC_BASE_URL = process.env.B2_PUBLIC_BASE_URL;
