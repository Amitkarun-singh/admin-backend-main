import xlsx from "xlsx";

export const parseExcel = <T = Record<string, unknown>>(
  filePath: string
): T[] => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  return xlsx.utils.sheet_to_json<T>(sheet);
};