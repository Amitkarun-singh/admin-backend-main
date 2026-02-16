import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = [".xlsx", ".csv"];
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowed.includes(ext)) {
        return cb(new Error("Only .xlsx or .csv files allowed"));
        }
        cb(null, true);
    }
});

export default upload;
