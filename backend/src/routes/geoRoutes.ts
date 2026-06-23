import { Router } from "express";
import { geoReverse, geoRoute, geoSearch } from "../controllers/geoController";

const router = Router();

// GET /api/geo/search?q=&limit=
router.get("/search", geoSearch);

// GET /api/geo/reverse?lat=&lng=
router.get("/reverse", geoReverse);

// GET /api/geo/route?startLat=&startLng=&endLat=&endLng=&profile=
router.get("/route", geoRoute);

export default router;
