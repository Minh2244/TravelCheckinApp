import { Router } from "express";
import { geoReverse, geoSearch } from "../controllers/geoController";

const router = Router();

// GET /api/geo/search?q=&limit=
router.get("/search", geoSearch);

// GET /api/geo/reverse?lat=&lng=
router.get("/reverse", geoReverse);

export default router;
