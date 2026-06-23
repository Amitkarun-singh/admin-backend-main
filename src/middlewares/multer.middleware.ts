import multer, { StorageEngine, FileFilterCallback } from "multer";
import path from "path";

// All uploads are stored temporarily in public/temp
const storage: StorageEngine = multer.diskStorage({
  destination: function (
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) {
    cb(null, "./public/temp");
  },
  filename: function (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// General-purpose upload (no file type restriction)
export const upload = multer({ storage });

// Bulk upload restricted to .xlsx and .csv files only
export const uploadBulk = multer({
  storage,
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const allowed = [".xlsx", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowed.includes(ext)) {
      return cb(new Error("Only .xlsx or .csv files allowed"));
    }
    cb(null, true);
  },
});