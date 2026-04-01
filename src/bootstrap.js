import dotenv from "dotenv";
console.log("env => ", process.cwd() + "/config.env");

dotenv.config({ path: process.cwd() + "/config.env" });

// nothing else here
