import fs from "fs";
import path from "path";

const papersDir = path.join(process.cwd(), "predict");

export const getPapers = ({ board, className, subject }) => {
  const dirPath = path.join(papersDir, board, className, subject);

  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const files = fs.readdirSync(dirPath);

  // Return structured array
  const papers = files.map((file) => {
    const relativePath = path.join(
      "predict",
      board,

      className,
      subject,
      file,
    );

    return {
      board,
      className,
      subject,
      filePath: relativePath.replace(/\\/g, "/"), // fix Windows slashes
    };
  });

  return papers;
};
