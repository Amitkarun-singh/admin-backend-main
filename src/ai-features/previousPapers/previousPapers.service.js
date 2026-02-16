import fs from "fs";
import path from "path";

const papersDir = path.join(process.cwd(), "papers");

export const getPapers = ({ board, year, className, subject }) => {
  const dirPath = path.join(papersDir, board, year, className, subject);

  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const files = fs.readdirSync(dirPath);

  // Return structured array
  const papers = files.map((file) => {
    const relativePath = path.join(
      "papers",
      board,
      year,
      className,
      subject,
      file,
    );

    return {
      board,
      year,
      className,
      subject,
      filePath: relativePath.replace(/\\/g, "/"), // fix Windows slashes
    };
  });

  return papers;
};
