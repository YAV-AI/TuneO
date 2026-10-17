// S3-compatible object storage (RustFS in docker compose).
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const BUCKET = process.env.S3_BUCKET || "tuneo";

const globalForS3 = globalThis as unknown as { tuneoS3?: S3Client };

export const s3 =
  globalForS3.tuneoS3 ??
  new S3Client({
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "rustfsadmin",
      secretAccessKey: process.env.S3_SECRET_KEY || "rustfsadmin",
    },
  });
if (process.env.NODE_ENV !== "production") globalForS3.tuneoS3 = s3;

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export function getObject(key: string, range?: string) {
  return s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: range }));
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
