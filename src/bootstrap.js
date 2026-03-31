import dotenv from "dotenv";
console.log(process.cwd() + "/config.env");

dotenv.config({ path: process.cwd() + "/config.env" });

// nothing else here
