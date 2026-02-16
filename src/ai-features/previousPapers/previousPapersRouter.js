import express from "express";
import { fetchPaper } from "./previousPapers.controller.js";

const router = express.Router();
router.use("/papers", express.static("papers"));

router.get("/papers", fetchPaper); // get specific paper

export default router;
