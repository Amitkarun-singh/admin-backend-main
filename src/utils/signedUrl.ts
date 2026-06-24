import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export const getSignedPdfUrl = async (
  key: string | null | undefined
): Promise<string | null> => {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    // Force browser to display the file inline (not download it)
    ResponseContentDisposition: "inline",
    // Tell the browser it is a PDF so it uses its built-in PDF viewer
    ResponseContentType: "application/pdf",
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

  return url;
};