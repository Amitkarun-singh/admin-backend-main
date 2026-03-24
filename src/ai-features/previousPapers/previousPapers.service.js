import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const bucketName = process.env.AWS_S3_BUCKET;
export const getPapers = async ({ board, year, className, subject }) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `papers/${board}/${year}/class-${className}/${subject}`,
  });
  const response = await s3Client.send(command);
  // console.log(response[1].Key);

  const files = (response.Contents || [])
    .filter((item) => item.Size > 0)
    .map((item) => ({
      board,
      year,
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
export const getFilePreviewUrl = async (filePath, expiresIn = 3600) => {
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
  filePath,
  fileName,
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
 * Get all available years for a given board
 * e.g. papers/CBSE/ → ["2023", "2024", "2025"]
 */
export const getYears = async ({ board }) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `papers/${board}/`,
    Delimiter: "/",
  });

  const response = await s3Client.send(command);

  const years = (response.CommonPrefixes || []).map((prefix) => {
    const parts = prefix.Prefix.split("/");
    return parts[parts.length - 2];
  });

  return { board, years };
};

/**
 * Get all available subjects for a given board, year, and class
 * e.g. papers/CBSE/2025/class-10/ → ["math", "science", "english"]
 */
export const getSubjects = async ({ board, year, className }) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `papers/${board}/${year}/class-${className}/`,
    Delimiter: "/",
  });

  const response = await s3Client.send(command);

  const subjects = (response.CommonPrefixes || []).map((prefix) => {
    const parts = prefix.Prefix.split("/");
    return parts[parts.length - 2];
  });

  return { board, year, className, subjects };
};

export const getClasses = async ({ board, year }) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: `papers/${board}/${year}/`,
    Delimiter: "/",
  });

  const response = await s3Client.send(command);

  const subjects = (response.CommonPrefixes || []).map((prefix) => {
    const parts = prefix.Prefix.split("/");
    return parts[parts.length - 2];
  });

  return { board, year, subjects };
};
