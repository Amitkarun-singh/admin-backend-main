import fs from "fs";
import csv from "csv-parser";

export const parseCSV = <T = Record<string, string>>(
  filePath: string
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data: T) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};