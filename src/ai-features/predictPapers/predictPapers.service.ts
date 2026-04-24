import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import strict from "node:assert/strict";

const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;

if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  throw new Error("Missing AWS configuration in environment variables");
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
const bucketName = process.env.AWS_S3_BUCKET;
type PapersArg = { board: string; className: string; subject: string };
export const getPapers = async ({ board, className, subject }: PapersArg) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `predict/${board}/class-${className}/${subject}`,
  });
  const response = await s3Client.send(command);
  // console.log(response[1].Key);

  const files = (response.Contents || [])
    .filter((item) => item.Size! > 0)
    .map((item) => ({
      board,

      className,
      subject,
      filePath: item.Key,
    }));

  return files;
};

/**
 * Generate a presigned URL to preview a file from S3
 * @param {string} filePath - The S3 object key (e.g. "papers/CBSE/2025/class-10/math/430-1-1_Mathematics Basic.pdf")
 * @param {number} expiresIn - URL expiry in seconds (default: 1 hour)
 */
export const getFilePreviewUrl = async (filePath: string, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: filePath,
    ResponseContentDisposition: "inline",
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    filePath,
    previewUrl: presignedUrl,
    expiresIn,
  };
};

/**
 * Generate a presigned URL to download a file from S3
 * @param {string} filePath - The S3 object key
 * @param {string} fileName - Optional custom filename for the download
 * @param {number} expiresIn - URL expiry in seconds (default: 1 hour)
 */
export const getFileDownloadUrl = async (
  filePath: string,
  fileName: string,
  expiresIn = 3600,
) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: filePath,
    ResponseContentDisposition: fileName
      ? `attachment; filename="${fileName}"`
      : "attachment",
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    filePath,
    downloadUrl: presignedUrl,
    expiresIn,
  };
};

/**
 * Get all available subjects for a given board, year, and class
 * e.g. papers/CBSE/2025/class-10/ → ["math", "science", "english"]
 */
type getSubjectsArg = { board: string; className: string };
export const getSubjects = async ({ board, className }: getSubjectsArg) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `predict/${board}/class-${className}/`,
    Delimiter: "/",
  });

  const response = await s3Client.send(command);

  const subjects = (response.CommonPrefixes || []).map((prefix) => {
    const parts = prefix?.Prefix?.split("/") || "";
    return parts[parts.length - 2];
  });

  return { board, className, subjects };
};

export const getClasses = async ({ board }: { board: string }) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `predict/${board}/`,
    Delimiter: "/",
  });

  const response = await s3Client.send(command);

  const subjects = (response.CommonPrefixes || []).map((prefix) => {
    const parts = prefix?.Prefix?.split("/") || "";
    return parts[parts.length - 2];
  });

  return { board, subjects };
};
