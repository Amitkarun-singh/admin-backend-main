import fs from "fs";
import path from "path";

/*
--------------------------------------------------------
UPLOAD FILE TO HOSTINGER PUBLIC STORAGE
--------------------------------------------------------

1. Multer uploads file to ./public/temp
2. This function moves file to ./public/notes
3. Generates public URL
4. Returns URL to store in DB
*/

export const uploadOnHostinger = async (
    localFilePath,
    className,
    subject,
    topic
    ) => {
    try {
        if (!localFilePath) return null;

        // create structured folder
        const folderPath = path.join(
        process.cwd(),
        "../public_html/full_notes",
        `class${className}`,
        subject.toLowerCase()
        );

        if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        }

        const fileName = `${topic.replace(/\s+/g, "-").toLowerCase()}.pdf`;

        const finalPath = path.join(folderPath, fileName);

        // move file from temp → notes folder
        fs.renameSync(localFilePath, finalPath);

        // generate public URL
        const publicUrl = `https://sandybrown-manatee-216868.hostingersite.com/full_notes/class${className}/${subject.toLowerCase()}/${fileName}`;

        return {
        url: publicUrl,
        path: finalPath,
        filename: fileName,
        };
    } catch (error) {
        throw new Error("Hostinger upload failed: " + error.message);
    }
};

/*
--------------------------------------------------------
DELETE FILE FROM HOSTINGER
--------------------------------------------------------
*/

export const deleteFromHostinger = async (fileUrl) => {
    try {
        if (!fileUrl) return;

        const fileName = fileUrl.split("/notes/")[1];

        const filePath = path.join(process.cwd(), "public/notes", fileName);

        if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        }

        return true;
    } catch (error) {
        throw new Error("Failed to delete file: " + error.message);
    }
};