-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: TravelCheckinApp
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ai_chat_history`
--

DROP TABLE IF EXISTS `ai_chat_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_chat_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `ai_model` varchar(50) DEFAULT 'Gemini',
  `prompt` text NOT NULL,
  `response` text NOT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `response_time_ms` int DEFAULT NULL,
  `prompt_tokens` int DEFAULT NULL,
  `completion_tokens` int DEFAULT NULL,
  `total_tokens` int DEFAULT NULL,
  `error_message` text,
  `model_version` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`history_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_chat_user_time` (`user_id`,`created_at`),
  CONSTRAINT `ai_chat_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_chat_history`
--

LOCK TABLES `ai_chat_history` WRITE;
/*!40000 ALTER TABLE `ai_chat_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_chat_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `details` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `audit_logs_user_fk` (`user_id`),
  CONSTRAINT `audit_logs_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=191 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'UPDATE_COMMISSION_RATE','{\"ownerId\":4,\"newRate\":3,\"timestamp\":\"2026-02-02T14:39:17.740Z\"}','2026-02-02 14:39:17'),(2,1,'UPDATE_COMMISSION_RATE','{\"ownerId\":4,\"newRate\":4,\"timestamp\":\"2026-02-02T14:44:05.674Z\"}','2026-02-02 14:44:05'),(3,1,'APPROVE_OWNER','{\"ownerId\":\"4\",\"timestamp\":\"2026-02-02T16:50:27.305Z\"}','2026-02-02 16:50:27'),(4,1,'APPROVE_OWNER','{\"ownerId\":\"4\",\"timestamp\":\"2026-02-02T16:50:36.367Z\"}','2026-02-02 16:50:36'),(5,1,'UPDATE_COMMISSION_RATE','{\"ownerId\":4,\"newRate\":5.5,\"timestamp\":\"2026-02-02T16:51:37.824Z\"}','2026-02-02 16:51:37'),(6,1,'APPROVE_OWNER','{\"ownerId\":\"4\",\"timestamp\":\"2026-02-02T16:51:52.749Z\"}','2026-02-02 16:51:52'),(7,1,'UPDATE_COMMISSION_RATE','{\"ownerId\":4,\"oldRate\":null,\"newRate\":1.5,\"reason\":null,\"timestamp\":\"2026-02-02T17:37:13.243Z\"}','2026-02-02 17:37:13'),(8,1,'APPROVE_OWNER','{\"ownerId\":\"4\",\"timestamp\":\"2026-02-02T17:37:20.288Z\"}','2026-02-02 17:37:20'),(9,1,'UPLOAD_ADMIN_AVATAR','{\"mimetype\":\"image/jpeg\",\"size\":334352,\"avatar_path\":\"/uploads/avatars/avatar-1-1770136267845-28dd48cff1d2.jpg\",\"timestamp\":\"2026-02-03T16:31:07.858Z\"}','2026-02-03 16:31:07'),(10,1,'UPDATE_ADMIN_PROFILE','{\"full_name\":\"Mai Nhựt Minh\",\"phone\":\"0869378427\",\"skip_avatar\":true,\"timestamp\":\"2026-02-03T16:31:07.891Z\"}','2026-02-03 16:31:07'),(11,1,'UPDATE_ADMIN_BANK','{\"bank_name\":\"Eximbank\",\"bank_account_last4\":\"2004\",\"timestamp\":\"2026-02-03T16:54:47.046Z\"}','2026-02-03 16:54:47'),(12,4,'CREATE_OWNER_LOCATION','{\"location_id\":1,\"location_name\":\"Cafe Trung Nguyên\",\"location_type\":\"restaurant\",\"image_url\":\"/uploads/locations/location-4-1770137748448-742673641852.jpg\",\"timestamp\":\"2026-02-03T16:55:48.658Z\"}','2026-02-03 16:55:48'),(13,4,'CREATE_OWNER_LOCATION','{\"location_id\":2,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"location_type\":\"hotel\",\"image_url\":\"/uploads/locations/location-4-1770137807261-b78586ed02ee.jpg\",\"timestamp\":\"2026-02-03T16:56:47.457Z\"}','2026-02-03 16:56:47'),(14,4,'CREATE_OWNER_LOCATION','{\"location_id\":3,\"location_name\":\"Bờ Kè Sông Hậu\",\"location_type\":\"tourist\",\"image_url\":\"/uploads/locations/location-4-1770137918199-2eb3920a2fb9.webp\",\"timestamp\":\"2026-02-03T16:58:38.208Z\"}','2026-02-03 16:58:38'),(15,1,'UPDATE_LOCATION_COMMISSION_RATE','{\"locationId\":3,\"oldRate\":2.5,\"newRate\":1,\"timestamp\":\"2026-02-03T16:59:02.996Z\"}','2026-02-03 16:59:02'),(16,1,'UPDATE_LOCATION_COMMISSION_RATE','{\"locationId\":2,\"oldRate\":2.5,\"newRate\":2,\"timestamp\":\"2026-02-03T16:59:12.472Z\"}','2026-02-03 16:59:12'),(17,1,'UPDATE_LOCATION_COMMISSION_RATE','{\"locationId\":1,\"oldRate\":2.5,\"newRate\":2,\"timestamp\":\"2026-02-03T16:59:17.451Z\"}','2026-02-03 16:59:17'),(18,1,'APPROVE_LOCATION','{\"locationId\":\"3\",\"timestamp\":\"2026-02-03T16:59:18.463Z\"}','2026-02-03 16:59:18'),(19,1,'APPROVE_LOCATION','{\"locationId\":\"2\",\"timestamp\":\"2026-02-03T16:59:19.103Z\"}','2026-02-03 16:59:19'),(20,1,'APPROVE_LOCATION','{\"locationId\":\"1\",\"timestamp\":\"2026-02-03T16:59:19.604Z\"}','2026-02-03 16:59:19'),(21,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":153129,\"image_path\":\"/uploads/services/service-4-1770138525156-fe5ffb2aad0e.jpg\",\"timestamp\":\"2026-02-03T17:08:45.158Z\"}','2026-02-03 17:08:45'),(22,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":1,\"timestamp\":\"2026-02-03T17:08:56.670Z\"}','2026-02-03 17:08:56'),(23,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":637111,\"image_path\":\"/uploads/services/service-4-1770138544156-dd278575e0e1.jpg\",\"timestamp\":\"2026-02-03T17:09:04.160Z\"}','2026-02-03 17:09:04'),(24,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":2,\"timestamp\":\"2026-02-03T17:09:30.630Z\"}','2026-02-03 17:09:30'),(25,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/png\",\"size\":615179,\"image_path\":\"/uploads/services/service-4-1770138590078-5c2d6b9234cc.png\",\"timestamp\":\"2026-02-03T17:09:50.082Z\"}','2026-02-03 17:09:50'),(26,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":3,\"timestamp\":\"2026-02-03T17:10:05.731Z\"}','2026-02-03 17:10:05'),(27,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":149483,\"image_path\":\"/uploads/services/service-4-1770138620805-5dbfff48e9d6.jpg\",\"timestamp\":\"2026-02-03T17:10:20.847Z\"}','2026-02-03 17:10:20'),(28,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":4,\"timestamp\":\"2026-02-03T17:11:04.839Z\"}','2026-02-03 17:11:04'),(29,4,'UPDATE_OWNER_PROFILE','{\"full_name\":\"Phan Khánh Quyên\",\"phone\":\"0869378422\",\"skip_avatar\":false,\"timestamp\":\"2026-02-03T17:12:15.518Z\"}','2026-02-03 17:12:15'),(30,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":14149,\"image_path\":\"/uploads/services/service-4-1770138817540-8ba4e25d35fe.jpg\",\"timestamp\":\"2026-02-03T17:13:37.542Z\"}','2026-02-03 17:13:37'),(31,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":5,\"timestamp\":\"2026-02-03T17:13:55.357Z\"}','2026-02-03 17:13:55'),(32,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":14149,\"image_path\":\"/uploads/services/service-4-1770138862528-57a00ac0c7e8.jpg\",\"timestamp\":\"2026-02-03T17:14:22.530Z\"}','2026-02-03 17:14:22'),(33,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":6,\"timestamp\":\"2026-02-03T17:14:26.406Z\"}','2026-02-03 17:14:26'),(34,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":19546,\"image_path\":\"/uploads/services/service-4-1770138895174-751ff3d9ef50.jpg\",\"timestamp\":\"2026-02-03T17:14:55.178Z\"}','2026-02-03 17:14:55'),(35,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":3,\"service_id\":7,\"timestamp\":\"2026-02-03T17:15:06.907Z\"}','2026-02-03 17:15:06'),(36,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/png\",\"size\":13065,\"image_path\":\"/uploads/services/service-4-1770138914751-85503641ffa6.png\",\"timestamp\":\"2026-02-03T17:15:14.794Z\"}','2026-02-03 17:15:14'),(37,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":3,\"service_id\":8,\"timestamp\":\"2026-02-03T17:15:34.543Z\"}','2026-02-03 17:15:34'),(38,1,'BULK_UPDATE_OWNER_SERVICE_APPROVAL','{\"scope\":\"ids\",\"status\":\"approved\",\"reason\":null,\"filter\":null,\"service_ids\":[8,7,6,5,4,3,2,1],\"exclude_service_ids\":[],\"affected\":8,\"timestamp\":\"2026-02-03T17:52:06.409Z\"}','2026-02-03 17:52:06'),(39,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng1\",\"room_id\":1,\"timestamp\":\"2026-02-03T19:20:28.758Z\"}','2026-02-03 19:20:28'),(40,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng2\",\"room_id\":2,\"timestamp\":\"2026-02-03T19:20:28.776Z\"}','2026-02-03 19:20:28'),(41,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng3\",\"room_id\":3,\"timestamp\":\"2026-02-03T19:20:28.793Z\"}','2026-02-03 19:20:28'),(42,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng4\",\"room_id\":4,\"timestamp\":\"2026-02-03T19:20:28.804Z\"}','2026-02-03 19:20:28'),(43,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng5\",\"room_id\":5,\"timestamp\":\"2026-02-03T19:20:28.817Z\"}','2026-02-03 19:20:28'),(44,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng6\",\"room_id\":6,\"timestamp\":\"2026-02-03T19:20:28.827Z\"}','2026-02-03 19:20:28'),(45,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng7\",\"room_id\":7,\"timestamp\":\"2026-02-03T19:20:28.839Z\"}','2026-02-03 19:20:28'),(46,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng8\",\"room_id\":8,\"timestamp\":\"2026-02-03T19:20:28.853Z\"}','2026-02-03 19:20:28'),(47,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng9\",\"room_id\":9,\"timestamp\":\"2026-02-03T19:20:28.865Z\"}','2026-02-03 19:20:28'),(48,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"floor_number\":1,\"room_number\":\"Phòng10\",\"room_id\":10,\"timestamp\":\"2026-02-03T19:20:28.879Z\"}','2026-02-03 19:20:28'),(49,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng1\",\"room_id\":11,\"timestamp\":\"2026-02-04T05:38:46.775Z\"}','2026-02-04 05:38:46'),(50,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng2\",\"room_id\":12,\"timestamp\":\"2026-02-04T05:38:46.825Z\"}','2026-02-04 05:38:46'),(51,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng3\",\"room_id\":13,\"timestamp\":\"2026-02-04T05:38:46.857Z\"}','2026-02-04 05:38:46'),(52,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng4\",\"room_id\":14,\"timestamp\":\"2026-02-04T05:38:46.888Z\"}','2026-02-04 05:38:46'),(53,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng5\",\"room_id\":15,\"timestamp\":\"2026-02-04T05:38:46.917Z\"}','2026-02-04 05:38:46'),(54,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng6\",\"room_id\":16,\"timestamp\":\"2026-02-04T05:38:46.947Z\"}','2026-02-04 05:38:46'),(55,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng7\",\"room_id\":17,\"timestamp\":\"2026-02-04T05:38:46.979Z\"}','2026-02-04 05:38:46'),(56,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng8\",\"room_id\":18,\"timestamp\":\"2026-02-04T05:38:47.006Z\"}','2026-02-04 05:38:47'),(57,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng9\",\"room_id\":19,\"timestamp\":\"2026-02-04T05:38:47.042Z\"}','2026-02-04 05:38:47'),(58,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":3,\"floor_number\":1,\"room_number\":\"Phòng10\",\"room_id\":20,\"timestamp\":\"2026-02-04T05:38:47.074Z\"}','2026-02-04 05:38:47'),(59,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng11\",\"room_id\":21,\"timestamp\":\"2026-02-04T05:39:29.733Z\"}','2026-02-04 05:39:29'),(60,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng12\",\"room_id\":22,\"timestamp\":\"2026-02-04T05:39:29.752Z\"}','2026-02-04 05:39:29'),(61,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng13\",\"room_id\":23,\"timestamp\":\"2026-02-04T05:39:29.764Z\"}','2026-02-04 05:39:29'),(62,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng14\",\"room_id\":24,\"timestamp\":\"2026-02-04T05:39:29.780Z\"}','2026-02-04 05:39:29'),(63,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng15\",\"room_id\":25,\"timestamp\":\"2026-02-04T05:39:29.792Z\"}','2026-02-04 05:39:29'),(64,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng16\",\"room_id\":26,\"timestamp\":\"2026-02-04T05:39:29.807Z\"}','2026-02-04 05:39:29'),(65,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng17\",\"room_id\":27,\"timestamp\":\"2026-02-04T05:39:29.819Z\"}','2026-02-04 05:39:29'),(66,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng18\",\"room_id\":28,\"timestamp\":\"2026-02-04T05:39:29.837Z\"}','2026-02-04 05:39:29'),(67,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng19\",\"room_id\":29,\"timestamp\":\"2026-02-04T05:39:29.852Z\"}','2026-02-04 05:39:29'),(68,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng20\",\"room_id\":30,\"timestamp\":\"2026-02-04T05:39:29.864Z\"}','2026-02-04 05:39:29'),(69,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng11\",\"room_id\":31,\"timestamp\":\"2026-02-04T05:48:21.768Z\"}','2026-02-04 05:48:21'),(70,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng12\",\"room_id\":32,\"timestamp\":\"2026-02-04T05:48:21.816Z\"}','2026-02-04 05:48:21'),(71,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng13\",\"room_id\":33,\"timestamp\":\"2026-02-04T05:48:21.852Z\"}','2026-02-04 05:48:21'),(72,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng14\",\"room_id\":34,\"timestamp\":\"2026-02-04T05:48:21.879Z\"}','2026-02-04 05:48:21'),(73,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng15\",\"room_id\":35,\"timestamp\":\"2026-02-04T05:48:21.916Z\"}','2026-02-04 05:48:21'),(74,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng16\",\"room_id\":36,\"timestamp\":\"2026-02-04T05:48:21.944Z\"}','2026-02-04 05:48:21'),(75,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng17\",\"room_id\":37,\"timestamp\":\"2026-02-04T05:48:21.970Z\"}','2026-02-04 05:48:21'),(76,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng18\",\"room_id\":38,\"timestamp\":\"2026-02-04T05:48:21.996Z\"}','2026-02-04 05:48:21'),(77,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng19\",\"room_id\":39,\"timestamp\":\"2026-02-04T05:48:22.023Z\"}','2026-02-04 05:48:22'),(78,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":4,\"floor_number\":2,\"room_number\":\"Phòng20\",\"room_id\":40,\"timestamp\":\"2026-02-04T05:48:22.055Z\"}','2026-02-04 05:48:22'),(79,4,'CREATE_OWNER_EMPLOYEE','{\"employee_id\":9,\"location_ids\":[1],\"timestamp\":\"2026-02-04T06:19:33.413Z\"}','2026-02-04 06:19:33'),(80,4,'CREATE_OWNER_EMPLOYEE','{\"employee_id\":10,\"location_ids\":[1],\"timestamp\":\"2026-02-04T06:20:08.056Z\"}','2026-02-04 06:20:08'),(81,4,'CREATE_OWNER_EMPLOYEE','{\"employee_id\":11,\"location_ids\":[2],\"timestamp\":\"2026-02-04T06:20:54.007Z\"}','2026-02-04 06:20:54'),(82,4,'CREATE_OWNER_EMPLOYEE','{\"employee_id\":12,\"location_ids\":[2],\"timestamp\":\"2026-02-04T06:21:34.521Z\"}','2026-02-04 06:21:34'),(83,4,'CREATE_OWNER_EMPLOYEE','{\"employee_id\":13,\"location_ids\":[3],\"timestamp\":\"2026-02-04T06:22:13.301Z\"}','2026-02-04 06:22:13'),(84,4,'CREATE_OWNER_EMPLOYEE','{\"employee_id\":14,\"location_ids\":[3],\"timestamp\":\"2026-02-04T06:22:36.364Z\"}','2026-02-04 06:22:36'),(85,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":11,\"status\":\"cleaning\",\"timestamp\":\"2026-02-04T06:24:15.861Z\"}','2026-02-04 06:24:15'),(86,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":11,\"status\":\"vacant\",\"timestamp\":\"2026-02-04T06:25:33.710Z\"}','2026-02-04 06:25:33'),(87,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":9,\"timestamp\":\"2026-02-04T07:16:31.640Z\"}','2026-02-04 07:16:31'),(88,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":null,\"floor_number\":1,\"room_number\":\"Phòng3\",\"room_id\":43,\"timestamp\":\"2026-02-04T07:16:31.670Z\"}','2026-02-04 07:16:31'),(89,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":10,\"timestamp\":\"2026-02-04T07:16:31.713Z\"}','2026-02-04 07:16:31'),(90,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":null,\"floor_number\":1,\"room_number\":\"Phòng4\",\"room_id\":44,\"timestamp\":\"2026-02-04T07:16:31.727Z\"}','2026-02-04 07:16:31'),(91,4,'DELETE_OWNER_SERVICE','{\"service_id\":9,\"timestamp\":\"2026-02-04T07:16:51.862Z\"}','2026-02-04 07:16:51'),(92,4,'DELETE_OWNER_SERVICE','{\"service_id\":10,\"timestamp\":\"2026-02-04T07:16:54.173Z\"}','2026-02-04 07:16:54'),(93,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":11,\"timestamp\":\"2026-02-04T07:17:53.157Z\"}','2026-02-04 07:17:53'),(94,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":null,\"floor_number\":2,\"room_number\":\"Phòng3\",\"room_id\":45,\"timestamp\":\"2026-02-04T07:17:53.180Z\"}','2026-02-04 07:17:53'),(95,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":12,\"timestamp\":\"2026-02-04T07:17:53.210Z\"}','2026-02-04 07:17:53'),(96,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":null,\"floor_number\":2,\"room_number\":\"Phòng4\",\"room_id\":46,\"timestamp\":\"2026-02-04T07:17:53.226Z\"}','2026-02-04 07:17:53'),(97,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":13,\"timestamp\":\"2026-02-04T07:17:53.254Z\"}','2026-02-04 07:17:53'),(98,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":null,\"floor_number\":2,\"room_number\":\"Phòng5\",\"room_id\":47,\"timestamp\":\"2026-02-04T07:17:53.267Z\"}','2026-02-04 07:17:53'),(99,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":2,\"service_id\":14,\"timestamp\":\"2026-02-04T07:17:53.299Z\"}','2026-02-04 07:17:53'),(100,4,'CREATE_HOTEL_ROOM','{\"location_id\":2,\"area_id\":null,\"floor_number\":2,\"room_number\":\"Phòng6\",\"room_id\":48,\"timestamp\":\"2026-02-04T07:17:53.312Z\"}','2026-02-04 07:17:53'),(101,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":14149,\"image_path\":\"/uploads/services/service-4-1770189532158-a1b34c72648d.jpg\",\"timestamp\":\"2026-02-04T07:18:52.162Z\"}','2026-02-04 07:18:52'),(102,4,'UPDATE_OWNER_SERVICE','{\"service_id\":11,\"timestamp\":\"2026-02-04T07:18:52.985Z\"}','2026-02-04 07:18:52'),(103,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":14149,\"image_path\":\"/uploads/services/service-4-1770189542024-7f8fa8c38ce8.jpg\",\"timestamp\":\"2026-02-04T07:19:02.066Z\"}','2026-02-04 07:19:02'),(104,4,'UPDATE_OWNER_SERVICE','{\"service_id\":12,\"timestamp\":\"2026-02-04T07:19:02.865Z\"}','2026-02-04 07:19:02'),(105,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":14149,\"image_path\":\"/uploads/services/service-4-1770189549590-039655050af5.jpg\",\"timestamp\":\"2026-02-04T07:19:09.591Z\"}','2026-02-04 07:19:09'),(106,4,'UPDATE_OWNER_SERVICE','{\"service_id\":13,\"timestamp\":\"2026-02-04T07:19:10.921Z\"}','2026-02-04 07:19:10'),(107,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":14149,\"image_path\":\"/uploads/services/service-4-1770189555726-2d27ebd6bd29.jpg\",\"timestamp\":\"2026-02-04T07:19:15.727Z\"}','2026-02-04 07:19:15'),(108,4,'UPDATE_OWNER_SERVICE','{\"service_id\":14,\"timestamp\":\"2026-02-04T07:19:16.527Z\"}','2026-02-04 07:19:16'),(109,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/png\",\"size\":416159,\"image_path\":\"/uploads/services/service-4-1770204076202-7de68a092498.png\",\"timestamp\":\"2026-02-04T11:21:16.205Z\"}','2026-02-04 11:21:16'),(110,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":15,\"timestamp\":\"2026-02-04T11:21:34.553Z\"}','2026-02-04 11:21:34'),(111,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":287690,\"image_path\":\"/uploads/services/service-4-1770204136123-d79c0486ee07.jpg\",\"timestamp\":\"2026-02-04T11:22:16.129Z\"}','2026-02-04 11:22:16'),(112,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":16,\"timestamp\":\"2026-02-04T11:22:44.292Z\"}','2026-02-04 11:22:44'),(113,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/jpeg\",\"size\":38585,\"image_path\":\"/uploads/services/service-4-1770204174545-16c353aeb017.jpg\",\"timestamp\":\"2026-02-04T11:22:54.589Z\"}','2026-02-04 11:22:54'),(114,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":17,\"timestamp\":\"2026-02-04T11:23:11.846Z\"}','2026-02-04 11:23:11'),(115,4,'UPLOAD_OWNER_SERVICE_IMAGE','{\"mimetype\":\"image/png\",\"size\":161502,\"image_path\":\"/uploads/services/service-4-1770204206208-fb46c5231bb6.png\",\"timestamp\":\"2026-02-04T11:23:26.210Z\"}','2026-02-04 11:23:26'),(116,4,'CREATE_OWNER_SERVICE','{\"owner_id\":4,\"location_id\":1,\"service_id\":18,\"timestamp\":\"2026-02-04T11:23:38.424Z\"}','2026-02-04 11:23:38'),(117,1,'BULK_UPDATE_OWNER_SERVICE_APPROVAL','{\"scope\":\"ids\",\"status\":\"approved\",\"reason\":null,\"filter\":null,\"service_ids\":[18,17,16,15,14,13,12,11],\"exclude_service_ids\":[],\"affected\":8,\"timestamp\":\"2026-02-04T11:24:15.494Z\"}','2026-02-04 11:24:15'),(118,4,'SELL_POS_TICKETS','{\"location_id\":3,\"service_id\":7,\"quantity\":1,\"timestamp\":\"2026-02-05T05:21:21.080Z\"}','2026-02-05 05:21:21'),(119,4,'SELL_POS_TICKETS_BATCH','{\"location_id\":3,\"items\":[{\"service_id\":7,\"quantity\":3},{\"service_id\":8,\"quantity\":1}],\"timestamp\":\"2026-02-05T05:29:46.604Z\"}','2026-02-05 05:29:46'),(120,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[42],\"stay_nights\":24,\"user_id\":15,\"timestamp\":\"2026-02-25T06:53:59.846Z\"}','2026-02-25 06:53:59'),(121,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":1,\"location_id\":2,\"room_id\":42,\"payment_id\":1,\"amount\":42000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-25T06:54:02.143Z\"}','2026-02-25 06:54:02'),(122,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":42,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:52:30.437Z\"}','2026-02-25 11:52:30'),(123,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":12,\"user_id\":16,\"timestamp\":\"2026-02-25T11:53:06.937Z\"}','2026-02-25 11:53:06'),(124,4,'UPDATE_OWNER_BANK','{\"bank_name\":\"Vietcombank\",\"bank_account_last4\":\"9759\",\"timestamp\":\"2026-02-25T11:53:28.609Z\"}','2026-02-25 11:53:28'),(125,4,'UPDATE_OWNER_BANK','{\"bank_name\":\"Vietcombank\",\"bank_account_last4\":\"9759\",\"timestamp\":\"2026-02-25T11:54:25.810Z\"}','2026-02-25 11:54:25'),(126,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":2,\"location_id\":2,\"room_id\":41,\"payment_id\":2,\"amount\":84000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-25T11:54:40.618Z\"}','2026-02-25 11:54:40'),(127,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:54:54.233Z\"}','2026-02-25 11:54:54'),(128,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"cleaning\",\"timestamp\":\"2026-02-25T11:54:55.913Z\"}','2026-02-25 11:54:55'),(129,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:54:56.572Z\"}','2026-02-25 11:54:56'),(130,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":24,\"user_id\":17,\"timestamp\":\"2026-02-25T11:55:14.452Z\"}','2026-02-25 11:55:14'),(131,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":3,\"location_id\":2,\"room_id\":41,\"payment_id\":3,\"amount\":42000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-25T11:55:16.568Z\"}','2026-02-25 11:55:16'),(132,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:56:21.784Z\"}','2026-02-25 11:56:21'),(133,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":24,\"user_id\":18,\"timestamp\":\"2026-02-25T11:56:24.258Z\"}','2026-02-25 11:56:24'),(134,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":4,\"location_id\":2,\"room_id\":41,\"payment_id\":4,\"amount\":42000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-25T11:56:26.234Z\"}','2026-02-25 11:56:26'),(135,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:59:10.758Z\"}','2026-02-25 11:59:10'),(136,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":24,\"user_id\":19,\"timestamp\":\"2026-02-25T11:59:13.685Z\"}','2026-02-25 11:59:13'),(137,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":5,\"location_id\":2,\"room_id\":41,\"payment_id\":5,\"amount\":42000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-25T11:59:31.186Z\"}','2026-02-25 11:59:31'),(138,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:59:34.550Z\"}','2026-02-25 11:59:34'),(139,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":24,\"user_id\":20,\"timestamp\":\"2026-02-25T11:59:36.958Z\"}','2026-02-25 11:59:36'),(140,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":6,\"location_id\":2,\"room_id\":41,\"payment_id\":6,\"amount\":42000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-25T11:59:37.743Z\"}','2026-02-25 11:59:37'),(141,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:59:40.168Z\"}','2026-02-25 11:59:40'),(142,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":24,\"user_id\":21,\"timestamp\":\"2026-02-25T11:59:44.603Z\"}','2026-02-25 11:59:44'),(143,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":7,\"location_id\":2,\"room_id\":41,\"payment_id\":7,\"amount\":42000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-25T11:59:49.188Z\"}','2026-02-25 11:59:49'),(144,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T11:59:51.840Z\"}','2026-02-25 11:59:51'),(145,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":24,\"user_id\":22,\"timestamp\":\"2026-02-25T12:00:02.395Z\"}','2026-02-25 12:00:02'),(146,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":8,\"location_id\":2,\"room_id\":41,\"payment_id\":8,\"amount\":42000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-25T12:00:04.075Z\"}','2026-02-25 12:00:04'),(147,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T12:00:47.474Z\"}','2026-02-25 12:00:47'),(148,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41,45],\"stay_nights\":24,\"user_id\":23,\"timestamp\":\"2026-02-25T12:15:01.854Z\"}','2026-02-25 12:15:01'),(149,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":9,\"location_id\":2,\"room_id\":41,\"payment_id\":9,\"amount\":42000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-25T12:15:12.561Z\"}','2026-02-25 12:15:12'),(150,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":10,\"location_id\":2,\"room_id\":45,\"payment_id\":10,\"amount\":39000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-25T12:15:12.618Z\"}','2026-02-25 12:15:12'),(151,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T12:15:16.067Z\"}','2026-02-25 12:15:16'),(152,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41],\"stay_nights\":24,\"user_id\":24,\"timestamp\":\"2026-02-25T12:15:29.274Z\"}','2026-02-25 12:15:29'),(153,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":11,\"location_id\":2,\"room_id\":41,\"payment_id\":11,\"amount\":42000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-25T12:16:25.708Z\"}','2026-02-25 12:16:25'),(154,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T12:16:49.037Z\"}','2026-02-25 12:16:49'),(155,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":45,\"status\":\"vacant\",\"timestamp\":\"2026-02-25T12:16:49.967Z\"}','2026-02-25 12:16:49'),(156,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41,42,45],\"stay_nights\":24,\"user_id\":25,\"timestamp\":\"2026-02-25T12:17:04.757Z\"}','2026-02-25 12:17:04'),(157,4,'UPDATE_OWNER_SERVICE','{\"service_id\":11,\"timestamp\":\"2026-02-27T02:25:48.043Z\"}','2026-02-27 02:25:48'),(158,4,'UPDATE_OWNER_SERVICE','{\"service_id\":12,\"timestamp\":\"2026-02-27T02:25:57.415Z\"}','2026-02-27 02:25:57'),(159,4,'UPDATE_OWNER_SERVICE','{\"service_id\":13,\"timestamp\":\"2026-02-27T02:26:02.741Z\"}','2026-02-27 02:26:02'),(160,4,'UPDATE_OWNER_SERVICE','{\"service_id\":14,\"timestamp\":\"2026-02-27T02:26:08.511Z\"}','2026-02-27 02:26:08'),(161,4,'UPDATE_OWNER_SERVICE','{\"service_id\":6,\"timestamp\":\"2026-02-27T02:26:42.244Z\"}','2026-02-27 02:26:42'),(162,4,'UPDATE_OWNER_SERVICE','{\"service_id\":6,\"timestamp\":\"2026-02-27T02:26:48.197Z\"}','2026-02-27 02:26:48'),(163,4,'UPDATE_OWNER_SERVICE','{\"service_id\":5,\"timestamp\":\"2026-02-27T02:26:53.575Z\"}','2026-02-27 02:26:53'),(164,4,'POS_ORDER_PAID','{\"order_id\":4,\"payment_id\":14,\"payment_method\":\"cash\",\"amount\":37000,\"transaction_source\":\"onsite_pos\",\"commission_rate\":0,\"commission_amount\":0,\"vat_rate\":0,\"vat_amount\":0,\"timestamp\":\"2026-02-27T02:30:10.236Z\"}','2026-02-27 02:30:10'),(165,4,'POS_ORDER_PAID','{\"order_id\":9,\"payment_id\":15,\"payment_method\":\"transfer\",\"amount\":17000,\"transaction_source\":\"onsite_pos\",\"commission_rate\":0,\"commission_amount\":0,\"vat_rate\":0,\"vat_amount\":0,\"timestamp\":\"2026-02-27T02:30:46.962Z\"}','2026-02-27 02:30:46'),(166,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":12,\"location_id\":2,\"room_id\":41,\"payment_id\":16,\"amount\":4050000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-27T02:32:26.439Z\"}','2026-02-27 02:32:26'),(167,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":13,\"location_id\":2,\"room_id\":42,\"payment_id\":17,\"amount\":4050000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-27T02:32:26.537Z\"}','2026-02-27 02:32:26'),(168,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":14,\"location_id\":2,\"room_id\":45,\"payment_id\":18,\"amount\":4050000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-27T02:32:26.607Z\"}','2026-02-27 02:32:26'),(169,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":42,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T02:32:31.184Z\"}','2026-02-27 02:32:31'),(170,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T02:32:35.979Z\"}','2026-02-27 02:32:35'),(171,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":45,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T02:32:37.111Z\"}','2026-02-27 02:32:37'),(172,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[42,45],\"stay_nights\":24,\"user_id\":26,\"timestamp\":\"2026-02-27T02:32:54.315Z\"}','2026-02-27 02:32:54'),(173,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":15,\"location_id\":2,\"room_id\":42,\"payment_id\":19,\"amount\":2000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-27T02:33:00.926Z\"}','2026-02-27 02:33:00'),(174,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":16,\"location_id\":2,\"room_id\":45,\"payment_id\":20,\"amount\":2000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-27T02:33:06.653Z\"}','2026-02-27 02:33:06'),(175,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":42,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T02:33:09.893Z\"}','2026-02-27 02:33:09'),(176,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":45,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T02:33:10.582Z\"}','2026-02-27 02:33:10'),(177,4,'POS_ORDER_PAID','{\"order_id\":10,\"payment_id\":21,\"payment_method\":\"transfer\",\"amount\":17000,\"transaction_source\":\"onsite_pos\",\"commission_rate\":0,\"commission_amount\":0,\"vat_rate\":0,\"vat_amount\":0,\"timestamp\":\"2026-02-27T02:37:18.531Z\"}','2026-02-27 02:37:18'),(178,1,'BULK_UPDATE_OWNER_SERVICE_APPROVAL','{\"scope\":\"ids\",\"status\":\"approved\",\"reason\":null,\"filter\":null,\"service_ids\":[14,13,12,11,6,5],\"exclude_service_ids\":[],\"affected\":6,\"timestamp\":\"2026-02-27T03:40:24.231Z\"}','2026-02-27 03:40:24'),(179,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41,42],\"stay_nights\":12,\"user_id\":27,\"timestamp\":\"2026-02-27T03:40:51.905Z\"}','2026-02-27 03:40:51'),(180,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":18,\"location_id\":2,\"room_id\":42,\"payment_id\":22,\"amount\":2000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-27T03:41:04.290Z\"}','2026-02-27 03:41:04'),(181,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":42,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T03:41:09.444Z\"}','2026-02-27 03:41:09'),(182,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[42],\"stay_nights\":12,\"user_id\":28,\"timestamp\":\"2026-02-27T03:41:35.425Z\"}','2026-02-27 03:41:35'),(183,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":17,\"location_id\":2,\"room_id\":41,\"payment_id\":23,\"amount\":2000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-27T03:41:40.898Z\"}','2026-02-27 03:41:40'),(184,4,'HOTEL_STAY_CHECKOUT','{\"stay_id\":19,\"location_id\":2,\"room_id\":42,\"payment_id\":24,\"amount\":2000,\"payment_method\":\"cash\",\"timestamp\":\"2026-02-27T03:41:40.977Z\"}','2026-02-27 03:41:40'),(185,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":42,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T03:41:43.463Z\"}','2026-02-27 03:41:43'),(186,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T03:41:44.279Z\"}','2026-02-27 03:41:44'),(187,4,'HOTEL_ROOM_CHECKIN','{\"location_id\":2,\"room_ids\":[41,42],\"stay_nights\":24,\"user_id\":29,\"timestamp\":\"2026-02-27T03:42:00.063Z\"}','2026-02-27 03:42:00'),(188,4,'HOTEL_STAY_CHECKOUT_BATCH','{\"stay_ids\":[20,21],\"location_id\":2,\"payment_id\":26,\"amount\":4000,\"payment_method\":\"transfer\",\"timestamp\":\"2026-02-27T03:42:32.961Z\"}','2026-02-27 03:42:32'),(189,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":41,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T03:42:40.554Z\"}','2026-02-27 03:42:40'),(190,4,'SET_HOTEL_ROOM_STATUS','{\"room_id\":42,\"status\":\"vacant\",\"timestamp\":\"2026-02-27T03:42:41.159Z\"}','2026-02-27 03:42:41');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `background_schedules`
--

DROP TABLE IF EXISTS `background_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `background_schedules` (
  `schedule_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `image_url` text NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `applied_to_setting` varchar(100) DEFAULT 'login_background',
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(50) DEFAULT 'Asia/Ho_Chi_Minh',
  PRIMARY KEY (`schedule_id`),
  KEY `idx_bg_active` (`is_active`),
  KEY `idx_bg_date` (`start_date`,`end_date`),
  KEY `background_schedules_admin_fk` (`created_by`),
  CONSTRAINT `background_schedules_admin_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `background_schedules`
--

LOCK TABLES `background_schedules` WRITE;
/*!40000 ALTER TABLE `background_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `background_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `booking_table_reservations`
--

DROP TABLE IF EXISTS `booking_table_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_table_reservations` (
  `reservation_id` bigint NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `table_id` int NOT NULL,
  `location_id` int NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `status` enum('active','checked_in','cancelled','no_show','released') NOT NULL DEFAULT 'active',
  `checked_in_at` datetime DEFAULT NULL,
  `actual_end_time` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by_user_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`reservation_id`),
  UNIQUE KEY `uniq_booking_table_reservation` (`booking_id`,`table_id`),
  KEY `idx_table_reservation_lookup` (`table_id`,`status`,`start_time`,`end_time`),
  KEY `idx_booking_table_reservation_booking` (`booking_id`),
  KEY `idx_booking_table_reservation_location` (`location_id`,`status`,`start_time`),
  KEY `booking_table_reservations_fk_cancelled_by` (`cancelled_by_user_id`),
  CONSTRAINT `booking_table_reservations_fk_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `booking_table_reservations_fk_cancelled_by` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `booking_table_reservations_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `booking_table_reservations_fk_table` FOREIGN KEY (`table_id`) REFERENCES `pos_tables` (`table_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_table_reservations`
--

LOCK TABLES `booking_table_reservations` WRITE;
/*!40000 ALTER TABLE `booking_table_reservations` DISABLE KEYS */;
/*!40000 ALTER TABLE `booking_table_reservations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `booking_tickets`
--

DROP TABLE IF EXISTS `booking_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_tickets` (
  `ticket_id` bigint NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `location_id` int NOT NULL,
  `service_id` int NOT NULL,
  `ticket_code` varchar(64) NOT NULL,
  `status` enum('unused','used','void') NOT NULL DEFAULT 'unused',
  `issued_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `used_at` timestamp NULL DEFAULT NULL,
  `used_by` int DEFAULT NULL,
  PRIMARY KEY (`ticket_id`),
  UNIQUE KEY `uniq_booking_ticket_code` (`ticket_code`),
  KEY `idx_booking_tickets_booking` (`booking_id`),
  KEY `idx_booking_tickets_location_status` (`location_id`,`status`),
  KEY `booking_tickets_fk_service` (`service_id`),
  KEY `booking_tickets_fk_used_by` (`used_by`),
  CONSTRAINT `booking_tickets_fk_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `booking_tickets_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `booking_tickets_fk_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `booking_tickets_fk_used_by` FOREIGN KEY (`used_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_tickets`
--

LOCK TABLES `booking_tickets` WRITE;
/*!40000 ALTER TABLE `booking_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `booking_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `booking_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `contact_phone` varchar(30) DEFAULT NULL,
  `service_id` int NOT NULL,
  `location_id` int NOT NULL,
  `booking_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `check_in_date` datetime NOT NULL,
  `check_out_date` datetime DEFAULT NULL,
  `quantity` int DEFAULT '1',
  `total_amount` decimal(15,2) NOT NULL,
  `discount_amount` decimal(15,2) DEFAULT '0.00',
  `final_amount` decimal(15,2) NOT NULL,
  `voucher_code` varchar(50) DEFAULT NULL,
  `status` enum('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  `source` enum('web','mobile','admin') DEFAULT 'mobile',
  `notes` text,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancelled_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pos_order_id` bigint DEFAULT NULL,
  PRIMARY KEY (`booking_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_location` (`location_id`),
  KEY `idx_status` (`status`),
  KEY `bookings_ibfk_2` (`service_id`),
  KEY `idx_bookings_pos_order` (`pos_order_id`),
  KEY `bookings_fk_cancelled_by` (`cancelled_by`),
  CONSTRAINT `bookings_fk_cancelled_by` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `bookings_fk_pos_order` FOREIGN KEY (`pos_order_id`) REFERENCES `pos_orders` (`order_id`) ON DELETE SET NULL,
  CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
  CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `bookings_ibfk_3` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `message_id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `conversation_id` varchar(100) DEFAULT NULL,
  `content` text NOT NULL,
  `attachments` json DEFAULT NULL,
  `status` enum('sent','delivered','read') DEFAULT 'sent',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_sender` (`sender_id`),
  KEY `idx_receiver` (`receiver_id`),
  KEY `idx_conversation` (`conversation_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_messages`
--

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `checkins`
--

DROP TABLE IF EXISTS `checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checkins` (
  `checkin_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `location_id` int NOT NULL,
  `booking_id` int DEFAULT NULL,
  `checkin_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `qr_code` text,
  `verified_by` int DEFAULT NULL,
  `status` enum('pending','verified','failed') DEFAULT 'pending',
  `device_info` text,
  `notes` text,
  `checkin_latitude` decimal(10,7) DEFAULT NULL,
  `checkin_longitude` decimal(10,7) DEFAULT NULL,
  PRIMARY KEY (`checkin_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_location` (`location_id`),
  KEY `checkins_ibfk_3` (`booking_id`),
  KEY `checkins_ibfk_4` (`verified_by`),
  KEY `idx_checkins_coords` (`checkin_latitude`,`checkin_longitude`),
  KEY `idx_checkins_time` (`checkin_time`),
  CONSTRAINT `checkins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `checkins_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `checkins_ibfk_3` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL,
  CONSTRAINT `checkins_ibfk_4` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checkins`
--

LOCK TABLES `checkins` WRITE;
/*!40000 ALTER TABLE `checkins` DISABLE KEYS */;
INSERT INTO `checkins` VALUES (1,15,2,NULL,'2026-02-25 06:53:59',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 2',NULL,NULL),(2,16,2,NULL,'2026-02-25 11:53:06',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(3,17,2,NULL,'2026-02-25 11:55:14',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(4,18,2,NULL,'2026-02-25 11:56:24',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(5,19,2,NULL,'2026-02-25 11:59:13',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(6,20,2,NULL,'2026-02-25 11:59:36',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(7,21,2,NULL,'2026-02-25 11:59:44',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(8,22,2,NULL,'2026-02-25 12:00:02',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(9,23,2,NULL,'2026-02-25 12:15:01',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(10,23,2,NULL,'2026-02-25 12:15:01',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng3',NULL,NULL),(11,24,2,NULL,'2026-02-25 12:15:29',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(12,25,2,NULL,'2026-02-25 12:17:04',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(13,25,2,NULL,'2026-02-25 12:17:04',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 2',NULL,NULL),(14,25,2,NULL,'2026-02-25 12:17:04',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng3',NULL,NULL),(15,26,2,NULL,'2026-02-27 02:32:54',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 2',NULL,NULL),(16,26,2,NULL,'2026-02-27 02:32:54',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng3',NULL,NULL),(17,27,2,NULL,'2026-02-27 03:40:51',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(18,27,2,NULL,'2026-02-27 03:40:51',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 2',NULL,NULL),(19,28,2,NULL,'2026-02-27 03:41:35',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 2',NULL,NULL),(20,29,2,NULL,'2026-02-27 03:42:00',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 1',NULL,NULL),(21,29,2,NULL,'2026-02-27 03:42:00',NULL,4,'verified',NULL,'Cảm ơn quý khách đã dùng dịch vụ Phòng 2',NULL,NULL);
/*!40000 ALTER TABLE `checkins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `commission_history`
--

DROP TABLE IF EXISTS `commission_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commission_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `old_rate` decimal(5,2) DEFAULT NULL,
  `new_rate` decimal(5,2) DEFAULT NULL,
  `changed_by` int DEFAULT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` text,
  PRIMARY KEY (`id`),
  KEY `idx_owner` (`owner_id`),
  KEY `comm_hist_changer_fk` (`changed_by`),
  CONSTRAINT `comm_hist_changer_fk` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `comm_hist_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commission_history`
--

LOCK TABLES `commission_history` WRITE;
/*!40000 ALTER TABLE `commission_history` DISABLE KEYS */;
INSERT INTO `commission_history` VALUES (1,4,NULL,3.00,1,'2026-02-02 14:39:17',NULL),(2,4,NULL,4.00,1,'2026-02-02 14:44:05',NULL),(3,4,NULL,5.50,1,'2026-02-02 16:51:37',NULL),(4,4,NULL,1.50,1,'2026-02-02 17:37:13',NULL);
/*!40000 ALTER TABLE `commission_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `commissions`
--

DROP TABLE IF EXISTS `commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commissions` (
  `commission_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `payment_id` int NOT NULL,
  `booking_id` int DEFAULT NULL,
  `commission_amount` decimal(15,2) NOT NULL,
  `vat_amount` decimal(15,2) NOT NULL,
  `total_due` decimal(15,2) NOT NULL,
  `due_date` date NOT NULL,
  `paid_amount` decimal(15,2) DEFAULT '0.00',
  `paid_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','paid','overdue') DEFAULT 'pending',
  `reminder_count` int DEFAULT '0',
  `last_reminder_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`commission_id`),
  KEY `idx_owner` (`owner_id`),
  KEY `idx_status_due` (`status`,`due_date`),
  KEY `commissions_ibfk_2` (`payment_id`),
  KEY `commissions_ibfk_3` (`booking_id`),
  CONSTRAINT `commissions_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
  CONSTRAINT `commissions_ibfk_2` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`payment_id`) ON DELETE RESTRICT,
  CONSTRAINT `commissions_ibfk_3` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commissions`
--

LOCK TABLES `commissions` WRITE;
/*!40000 ALTER TABLE `commissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `commissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_locations`
--

DROP TABLE IF EXISTS `employee_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `location_id` int NOT NULL,
  `owner_id` int NOT NULL,
  `permissions` json DEFAULT NULL COMMENT '{"can_scan": true, "view_revenue": false}',
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') DEFAULT 'active',
  `position` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_location` (`employee_id`,`location_id`),
  KEY `employee_locations_ibfk_2` (`location_id`),
  KEY `employee_locations_ibfk_3` (`owner_id`),
  CONSTRAINT `employee_locations_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `employee_locations_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `employee_locations_ibfk_3` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_locations`
--

LOCK TABLES `employee_locations` WRITE;
/*!40000 ALTER TABLE `employee_locations` DISABLE KEYS */;
INSERT INTO `employee_locations` VALUES (1,9,1,4,'{\"can_scan\": true, \"can_manage_bookings\": true, \"can_manage_services\": true}','2026-02-04 06:19:33','active','Thu ngân'),(2,10,1,4,'{\"can_scan\": true, \"can_manage_bookings\": true, \"can_manage_services\": true}','2026-02-04 06:20:08','active','Thu ngân'),(3,11,2,4,'{\"can_scan\": true, \"can_manage_bookings\": true, \"can_manage_services\": true}','2026-02-04 06:20:54','active','Lễ tân'),(4,12,2,4,'{\"can_scan\": true, \"can_manage_bookings\": true, \"can_manage_services\": true}','2026-02-04 06:21:34','active','Buồng phòng'),(5,13,3,4,'{\"can_scan\": true, \"can_manage_bookings\": true, \"can_manage_services\": true}','2026-02-04 06:22:13','active','Soát vé'),(6,14,3,4,'{\"can_scan\": true, \"can_manage_bookings\": true, \"can_manage_services\": true}','2026-02-04 06:22:36','active','Hướng dẫn');
/*!40000 ALTER TABLE `employee_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `favorite_locations`
--

DROP TABLE IF EXISTS `favorite_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorite_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `location_id` int NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_location` (`user_id`,`location_id`),
  KEY `favorite_locations_ibfk_2` (`location_id`),
  CONSTRAINT `favorite_locations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `favorite_locations_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `favorite_locations`
--

LOCK TABLES `favorite_locations` WRITE;
/*!40000 ALTER TABLE `favorite_locations` DISABLE KEYS */;
/*!40000 ALTER TABLE `favorite_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hotel_rooms`
--

DROP TABLE IF EXISTS `hotel_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hotel_rooms` (
  `room_id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `service_id` int DEFAULT NULL,
  `area_id` int DEFAULT NULL,
  `floor_number` int NOT NULL,
  `room_number` varchar(20) NOT NULL,
  `pos_x` int DEFAULT NULL,
  `pos_y` int DEFAULT NULL,
  `status` enum('vacant','occupied','reserved','cleaning') NOT NULL DEFAULT 'vacant',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`room_id`),
  UNIQUE KEY `uniq_room_per_location` (`location_id`,`room_number`),
  UNIQUE KEY `uniq_room_service_per_location` (`location_id`,`service_id`),
  KEY `idx_rooms_location_floor` (`location_id`,`floor_number`),
  KEY `idx_rooms_location_area` (`location_id`,`area_id`),
  KEY `hotel_rooms_fk_service` (`service_id`),
  KEY `hotel_rooms_fk_area` (`area_id`),
  CONSTRAINT `hotel_rooms_fk_area` FOREIGN KEY (`area_id`) REFERENCES `pos_areas` (`area_id`) ON DELETE SET NULL,
  CONSTRAINT `hotel_rooms_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `hotel_rooms_fk_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hotel_rooms`
--

LOCK TABLES `hotel_rooms` WRITE;
/*!40000 ALTER TABLE `hotel_rooms` DISABLE KEYS */;
INSERT INTO `hotel_rooms` VALUES (41,2,5,NULL,1,'Phòng 1',5,9,'vacant','2026-02-04 06:52:18','2026-02-27 03:42:40'),(42,2,6,NULL,1,'Phòng 2',169,0,'vacant','2026-02-04 06:52:18','2026-02-27 03:42:41'),(45,2,11,NULL,2,'Phòng3',8,0,'vacant','2026-02-04 07:17:53','2026-02-27 02:33:10'),(46,2,12,NULL,2,'Phòng4',175,3,'vacant','2026-02-04 07:17:53','2026-02-04 07:22:37'),(47,2,13,NULL,2,'Phòng5',342,1,'vacant','2026-02-04 07:17:53','2026-02-04 07:22:40'),(48,2,14,NULL,2,'Phòng6',507,2,'vacant','2026-02-04 07:17:53','2026-02-04 07:22:42');
/*!40000 ALTER TABLE `hotel_rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hotel_stay_items`
--

DROP TABLE IF EXISTS `hotel_stay_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hotel_stay_items` (
  `stay_item_id` bigint NOT NULL AUTO_INCREMENT,
  `stay_id` bigint NOT NULL,
  `service_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(15,2) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`stay_item_id`),
  KEY `idx_stay_items_stay` (`stay_id`),
  KEY `hotel_stay_items_fk_service` (`service_id`),
  CONSTRAINT `hotel_stay_items_fk_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `hotel_stay_items_fk_stay` FOREIGN KEY (`stay_id`) REFERENCES `hotel_stays` (`stay_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hotel_stay_items`
--

LOCK TABLES `hotel_stay_items` WRITE;
/*!40000 ALTER TABLE `hotel_stay_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `hotel_stay_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hotel_stays`
--

DROP TABLE IF EXISTS `hotel_stays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hotel_stays` (
  `stay_id` bigint NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `room_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `booking_id` int DEFAULT NULL,
  `status` enum('reserved','inhouse','checked_out','cancelled') NOT NULL DEFAULT 'inhouse',
  `checkin_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `checkout_time` timestamp NULL DEFAULT NULL,
  `expected_checkin` datetime DEFAULT NULL,
  `expected_checkout` datetime DEFAULT NULL,
  `subtotal_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `final_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`stay_id`),
  KEY `idx_stays_location_status` (`location_id`,`status`),
  KEY `idx_stays_room_status` (`room_id`,`status`),
  KEY `hotel_stays_fk_user` (`user_id`),
  KEY `hotel_stays_fk_booking` (`booking_id`),
  KEY `hotel_stays_fk_created_by` (`created_by`),
  KEY `hotel_stays_fk_closed_by` (`closed_by`),
  CONSTRAINT `hotel_stays_fk_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL,
  CONSTRAINT `hotel_stays_fk_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `hotel_stays_fk_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `hotel_stays_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `hotel_stays_fk_room` FOREIGN KEY (`room_id`) REFERENCES `hotel_rooms` (`room_id`) ON DELETE CASCADE,
  CONSTRAINT `hotel_stays_fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hotel_stays`
--

LOCK TABLES `hotel_stays` WRITE;
/*!40000 ALTER TABLE `hotel_stays` DISABLE KEYS */;
INSERT INTO `hotel_stays` VALUES (1,2,42,15,NULL,'checked_out','2026-02-25 06:54:00','2026-02-25 06:54:02','2026-02-25 13:54:00','2026-02-26 13:54:00',41666.67,0.00,42000.00,'{\"guest_full_name\":\"k\",\"guest_phone\":\"k\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 06:53:59','2026-02-25 06:54:02'),(2,2,41,16,NULL,'checked_out','2026-02-25 11:53:07','2026-02-25 11:54:41','2026-02-25 18:53:07','2026-02-26 06:53:07',83333.33,0.00,84000.00,'{\"guest_full_name\":\"minh\",\"guest_phone\":\"01234567789\",\"stay_nights\":12,\"room_unit_price\":2500000,\"room_amount\":30000000,\"extra_notes\":null}',4,4,'2026-02-25 11:53:06','2026-02-25 11:54:40'),(3,2,41,17,NULL,'checked_out','2026-02-25 11:55:14','2026-02-25 11:55:17','2026-02-25 18:55:14','2026-02-26 18:55:14',41666.67,0.00,42000.00,'{\"guest_full_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 11:55:14','2026-02-25 11:55:16'),(4,2,41,18,NULL,'checked_out','2026-02-25 11:56:24','2026-02-25 11:56:26','2026-02-25 18:56:24','2026-02-26 18:56:24',41666.67,0.00,42000.00,'{\"guest_full_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 11:56:24','2026-02-25 11:56:26'),(5,2,41,19,NULL,'checked_out','2026-02-25 11:59:14','2026-02-25 11:59:31','2026-02-25 18:59:14','2026-02-26 18:59:14',41666.67,0.00,42000.00,'{\"guest_full_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 11:59:13','2026-02-25 11:59:31'),(6,2,41,20,NULL,'checked_out','2026-02-25 11:59:37','2026-02-25 11:59:38','2026-02-25 18:59:37','2026-02-26 18:59:37',41666.67,0.00,42000.00,'{\"guest_full_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 11:59:36','2026-02-25 11:59:37'),(7,2,41,21,NULL,'checked_out','2026-02-25 11:59:45','2026-02-25 11:59:49','2026-02-25 18:59:45','2026-02-26 18:59:45',41666.67,0.00,42000.00,'{\"guest_full_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 11:59:44','2026-02-25 11:59:49'),(8,2,41,22,NULL,'checked_out','2026-02-25 12:00:02','2026-02-25 12:00:04','2026-02-25 19:00:02','2026-02-26 19:00:02',41666.67,0.00,42000.00,'{\"guest_full_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 12:00:02','2026-02-25 12:00:04'),(9,2,41,23,NULL,'checked_out','2026-02-25 12:15:02','2026-02-25 12:15:13','2026-02-25 19:15:02','2026-02-26 19:15:02',41666.67,0.00,42000.00,'{\"guest_full_name\":\"La Hoàn\",\"guest_phone\":\"0987654321\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 12:15:01','2026-02-25 12:15:12'),(10,2,45,23,NULL,'checked_out','2026-02-25 12:15:02','2026-02-25 12:15:13','2026-02-25 19:15:02','2026-02-26 19:15:02',38333.33,0.00,39000.00,'{\"guest_full_name\":\"La Hoàn\",\"guest_phone\":\"0987654321\",\"stay_nights\":24,\"room_unit_price\":2300000,\"room_amount\":55200000,\"extra_notes\":null}',4,4,'2026-02-25 12:15:01','2026-02-25 12:15:12'),(11,2,41,24,NULL,'checked_out','2026-02-25 12:15:29','2026-02-25 12:16:26','2026-02-25 19:15:29','2026-02-26 19:15:29',41666.67,0.00,42000.00,'{\"guest_full_name\":\"Hoàn\",\"guest_phone\":\"0987654333\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 12:15:29','2026-02-25 12:16:25'),(12,2,41,25,NULL,'checked_out','2026-02-25 12:17:05','2026-02-27 02:32:26','2026-02-25 19:17:05','2026-02-26 19:17:05',4050000.00,0.00,4050000.00,'{\"guest_full_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 12:17:04','2026-02-27 02:32:26'),(13,2,42,25,NULL,'checked_out','2026-02-25 12:17:05','2026-02-27 02:32:27','2026-02-25 19:17:05','2026-02-26 19:17:05',4050000.00,0.00,4050000.00,'{\"guest_full_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"stay_nights\":24,\"room_unit_price\":2500000,\"room_amount\":60000000,\"extra_notes\":null}',4,4,'2026-02-25 12:17:04','2026-02-27 02:32:26'),(14,2,45,25,NULL,'checked_out','2026-02-25 12:17:05','2026-02-27 02:32:27','2026-02-25 19:17:05','2026-02-26 19:17:05',4050000.00,0.00,4050000.00,'{\"guest_full_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"stay_nights\":24,\"room_unit_price\":2300000,\"room_amount\":55200000,\"extra_notes\":null}',4,4,'2026-02-25 12:17:04','2026-02-27 02:32:26'),(15,2,42,26,NULL,'checked_out','2026-02-27 02:32:54','2026-02-27 02:33:01','2026-02-27 09:32:54','2026-02-28 09:32:54',1666.67,0.00,2000.00,'{\"guest_full_name\":\"anh an\",\"guest_phone\":\"0123456787\",\"stay_nights\":24,\"room_unit_price\":100000,\"room_amount\":2400000,\"extra_notes\":null}',4,4,'2026-02-27 02:32:54','2026-02-27 02:33:00'),(16,2,45,26,NULL,'checked_out','2026-02-27 02:32:54','2026-02-27 02:33:07','2026-02-27 09:32:54','2026-02-28 09:32:54',1666.67,0.00,2000.00,'{\"guest_full_name\":\"anh an\",\"guest_phone\":\"0123456787\",\"stay_nights\":24,\"room_unit_price\":100000,\"room_amount\":2400000,\"extra_notes\":null}',4,4,'2026-02-27 02:32:54','2026-02-27 02:33:06'),(17,2,41,27,NULL,'checked_out','2026-02-27 03:40:52','2026-02-27 03:41:41','2026-02-27 10:40:52','2026-02-27 22:40:52',1666.67,0.00,2000.00,'{\"guest_full_name\":\"Văn An\",\"guest_phone\":\"0123456789\",\"stay_nights\":12,\"room_unit_price\":100000,\"room_amount\":1200000,\"extra_notes\":null}',4,4,'2026-02-27 03:40:51','2026-02-27 03:41:40'),(18,2,42,27,NULL,'checked_out','2026-02-27 03:40:52','2026-02-27 03:41:04','2026-02-27 10:40:52','2026-02-27 22:40:52',1666.67,0.00,2000.00,'{\"guest_full_name\":\"Văn An\",\"guest_phone\":\"0123456789\",\"stay_nights\":12,\"room_unit_price\":100000,\"room_amount\":1200000,\"extra_notes\":null}',4,4,'2026-02-27 03:40:51','2026-02-27 03:41:04'),(19,2,42,28,NULL,'checked_out','2026-02-27 03:41:35','2026-02-27 03:41:41','2026-02-27 10:41:35','2026-02-27 22:41:35',1666.67,0.00,2000.00,'{\"guest_full_name\":\"Văn An\",\"guest_phone\":\"0123456789\",\"stay_nights\":12,\"room_unit_price\":100000,\"room_amount\":1200000,\"extra_notes\":null}',4,4,'2026-02-27 03:41:35','2026-02-27 03:41:40'),(20,2,41,29,NULL,'checked_out','2026-02-27 03:42:00','2026-02-27 03:42:33','2026-02-27 10:42:00','2026-02-28 10:42:00',1666.67,0.00,2000.00,'{\"guest_full_name\":\"Văn An\",\"guest_phone\":\"0123456565\",\"stay_nights\":24,\"room_unit_price\":100000,\"room_amount\":2400000,\"extra_notes\":null}',4,4,'2026-02-27 03:42:00','2026-02-27 03:42:32'),(21,2,42,29,NULL,'checked_out','2026-02-27 03:42:00','2026-02-27 03:42:33','2026-02-27 10:42:00','2026-02-28 10:42:00',1666.67,0.00,2000.00,'{\"guest_full_name\":\"Văn An\",\"guest_phone\":\"0123456565\",\"stay_nights\":24,\"room_unit_price\":100000,\"room_amount\":2400000,\"extra_notes\":null}',4,4,'2026-02-27 03:42:00','2026-02-27 03:42:32');
/*!40000 ALTER TABLE `hotel_stays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `itineraries`
--

DROP TABLE IF EXISTS `itineraries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itineraries` (
  `itinerary_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `locations` json DEFAULT NULL,
  `total_distance_km` decimal(5,2) DEFAULT '0.00',
  `estimated_time_hours` decimal(5,2) DEFAULT '0.00',
  `is_ai_recommended` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`itinerary_id`),
  KEY `itineraries_ibfk_1` (`user_id`),
  CONSTRAINT `itineraries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `itineraries`
--

LOCK TABLES `itineraries` WRITE;
/*!40000 ALTER TABLE `itineraries` DISABLE KEYS */;
/*!40000 ALTER TABLE `itineraries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `location_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int DEFAULT NULL,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT '2.50',
  `location_name` varchar(255) NOT NULL,
  `location_type` enum('hotel','restaurant','tourist','cafe','resort','other') NOT NULL,
  `description` text,
  `address` text NOT NULL,
  `province` varchar(100) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `images` json DEFAULT NULL,
  `first_image` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`images`,_utf8mb4'$[0]'))) STORED,
  `opening_hours` json DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `is_eco_friendly` tinyint(1) DEFAULT '0',
  `status` enum('active','inactive','pending') DEFAULT 'pending',
  `previous_status` enum('active','inactive','pending') DEFAULT NULL,
  `rejection_reason` text,
  `rating` decimal(2,1) DEFAULT '0.0',
  `total_reviews` int DEFAULT '0',
  `total_checkins` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `osm_type` enum('node','way','relation') DEFAULT NULL,
  `osm_id` bigint DEFAULT NULL,
  `source` enum('osm','owner','admin') NOT NULL,
  `osm_ref_unique` varchar(64) GENERATED ALWAYS AS ((case when (`source` = _utf8mb4'osm') then concat(`osm_type`,_utf8mb4':',`osm_id`) else NULL end)) STORED,
  PRIMARY KEY (`location_id`),
  UNIQUE KEY `uniq_locations_osm_ref` (`osm_ref_unique`),
  KEY `idx_owner` (`owner_id`),
  KEY `idx_type` (`location_type`),
  KEY `idx_location` (`latitude`,`longitude`),
  KEY `idx_locations_province` (`province`),
  KEY `idx_locations_deleted_at` (`deleted_at`),
  CONSTRAINT `locations_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `chk_locations_osm_refs` CHECK ((((`source` = _utf8mb4'osm') and (`osm_type` is not null) and (`osm_id` is not null)) or ((`source` <> _utf8mb4'osm') and (`osm_type` is null) and (`osm_id` is null))))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locations`
--

LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
INSERT INTO `locations` (`location_id`, `owner_id`, `commission_rate`, `location_name`, `location_type`, `description`, `address`, `province`, `latitude`, `longitude`, `images`, `opening_hours`, `phone`, `email`, `website`, `is_eco_friendly`, `status`, `previous_status`, `rejection_reason`, `rating`, `total_reviews`, `total_checkins`, `created_at`, `updated_at`, `deleted_at`, `osm_type`, `osm_id`, `source`) VALUES (1,4,2.00,'Cafe Trung Nguyên','restaurant','Quán cafe lâu đời','Trung Nguyên E-Coffee, Trần Chiên, Phường Cái Răng, Thành phố Cần Thơ, 94000, Việt Nam','Thành phố Cần Thơ',9.99862769,105.76025254,'[\"/uploads/locations/location-4-1770137748448-742673641852.jpg\"]',NULL,'0869378422','memory3367@gmail.com',NULL,0,'active',NULL,NULL,0.0,0,0,'2026-02-03 16:55:48','2026-02-03 16:59:19',NULL,NULL,NULL,'owner'),(2,4,2.00,'Nhà Trọ Phú Mỹ','hotel',NULL,'Trần Chiên, Phường Cái Răng, Thành phố Cần Thơ, 94000, Việt Nam','Thành phố Cần Thơ',9.99771374,105.76062810,'[\"/uploads/locations/location-4-1770137807261-b78586ed02ee.jpg\"]',NULL,'0869378422','memory3367@gmail.com',NULL,0,'active',NULL,NULL,0.0,0,0,'2026-02-03 16:56:47','2026-02-03 16:59:19',NULL,NULL,NULL,'owner'),(3,4,1.00,'Bờ Kè Sông Hậu','tourist','Nơi Du Lịch lí tưởng','Bờ kè sông Hậu, Trần Văn Khéo, Phường Cái Khế, Thành phố Cần Thơ, 94111, Việt Nam','Thành phố Cần Thơ',10.04916039,105.79105498,'[\"/uploads/locations/location-4-1770137918199-2eb3920a2fb9.webp\"]',NULL,'0869378422','memory3367@gmail.com',NULL,0,'active',NULL,NULL,0.0,0,0,'2026-02-03 16:58:38','2026-02-03 16:59:18',NULL,NULL,NULL,'owner');
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_attempts`
--

DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_attempts` (
  `email` varchar(255) NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`email`),
  KEY `idx_locked_until` (`locked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_attempts`
--

LOCK TABLES `login_attempts` WRITE;
/*!40000 ALTER TABLE `login_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_history`
--

DROP TABLE IF EXISTS `login_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_history` (
  `login_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `role` enum('user','owner','employee','admin') DEFAULT NULL,
  `success` tinyint(1) NOT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` text,
  `device_info` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`login_id`),
  KEY `idx_login_history_user_id` (`user_id`),
  KEY `idx_login_history_email` (`email`),
  KEY `idx_login_history_created_at` (`created_at`),
  CONSTRAINT `login_history_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_history`
--

LOCK TABLES `login_history` WRITE;
/*!40000 ALTER TABLE `login_history` DISABLE KEYS */;
INSERT INTO `login_history` VALUES (1,8,'sathuonline0788746659@gmail.com','user',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-02 16:54:52'),(2,4,'memory3367@gmail.com','owner',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-02 16:54:59'),(3,8,'sathuonline0788746659@gmail.com','user',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-02 17:19:12'),(4,4,'memory3367@gmail.com','owner',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-02 17:37:52'),(5,1,'minhmap3367@gmail.com','admin',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',NULL,'2026-02-03 16:26:10'),(6,1,'minhmap3367@gmail.com','admin',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',NULL,'2026-02-04 07:34:33'),(7,8,'sathuonline0788746659@gmail.com','user',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-04 07:38:59'),(8,4,'memory3367@gmail.com','owner',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',NULL,'2026-02-04 07:44:13'),(9,1,'minhmap3367@gmail.com','admin',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',NULL,'2026-02-04 11:24:07'),(10,1,'minhmap3367@gmail.com','admin',1,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',NULL,'2026-02-25 11:53:40');
/*!40000 ALTER TABLE `login_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `otp_codes`
--

DROP TABLE IF EXISTS `otp_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `otp_code` varchar(10) NOT NULL,
  `type` enum('REGISTER','FORGOT_PASSWORD') NOT NULL,
  `expires_at` datetime NOT NULL,
  `is_used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_otp` (`email`,`otp_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `otp_codes`
--

LOCK TABLES `otp_codes` WRITE;
/*!40000 ALTER TABLE `otp_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `otp_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_profiles`
--

DROP TABLE IF EXISTS `owner_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_profiles` (
  `owner_id` int NOT NULL,
  `bank_account` varchar(50) NOT NULL,
  `bank_name` varchar(100) NOT NULL,
  `account_holder` varchar(255) NOT NULL,
  `qr_code` text,
  `contact_info` text,
  `business_license` varchar(255) DEFAULT NULL,
  `cccd_number` varchar(30) DEFAULT NULL,
  `cccd_front_url` text,
  `cccd_back_url` text,
  `membership_level` enum('basic','pro','vip') DEFAULT 'basic',
  `commission_rate` decimal(5,2) DEFAULT '2.50',
  `total_revenue` decimal(15,2) DEFAULT '0.00',
  `approval_status` enum('pending','approved','rejected') DEFAULT 'pending',
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `terms_accepted_at` timestamp NULL DEFAULT NULL,
  `terms_accepted_ip` varchar(64) DEFAULT NULL,
  `terms_accepted_user_agent` text,
  `terms_token` varchar(128) DEFAULT NULL,
  `terms_token_expires` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`owner_id`),
  KEY `idx_approval_status` (`approval_status`),
  KEY `idx_terms_token` (`terms_token`),
  KEY `owner_profiles_ibfk_2` (`approved_by`),
  CONSTRAINT `owner_profiles_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `owner_profiles_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_profiles`
--

LOCK TABLES `owner_profiles` WRITE;
/*!40000 ALTER TABLE `owner_profiles` DISABLE KEYS */;
INSERT INTO `owner_profiles` VALUES (4,'1030549759','Vietcombank','Minh','https://img.vietqr.io/image/970436-1030549759-qr_only.png?addInfo=Checkin',NULL,NULL,NULL,NULL,NULL,'basic',1.50,0.00,'approved','2026-02-02 17:37:20',1,NULL,NULL,NULL,NULL,NULL,'2026-02-02 17:37:13','2026-02-25 11:53:28');
/*!40000 ALTER TABLE `owner_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_violations`
--

DROP TABLE IF EXISTS `owner_violations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_violations` (
  `violation_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`violation_id`),
  KEY `idx_violation_owner` (`owner_id`),
  KEY `idx_violation_created` (`created_at`),
  KEY `owner_violations_admin_fk` (`created_by`),
  CONSTRAINT `owner_violations_admin_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `owner_violations_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_violations`
--

LOCK TABLES `owner_violations` WRITE;
/*!40000 ALTER TABLE `owner_violations` DISABLE KEYS */;
/*!40000 ALTER TABLE `owner_violations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `location_id` int NOT NULL,
  `booking_id` int DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `transaction_source` enum('online_booking','onsite_pos') NOT NULL DEFAULT 'onsite_pos',
  `commission_rate` decimal(5,2) DEFAULT '2.50',
  `commission_amount` decimal(15,2) NOT NULL,
  `vat_rate` decimal(5,2) DEFAULT '10.00',
  `vat_amount` decimal(15,2) NOT NULL,
  `owner_receivable` decimal(15,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT 'VietQR',
  `transaction_code` varchar(255) DEFAULT NULL,
  `qr_data` text,
  `payment_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `performed_by_user_id` int DEFAULT NULL,
  `performed_by_role` enum('owner','employee','user') DEFAULT NULL,
  `performed_by_name` varchar(255) DEFAULT NULL,
  `reconciled_at` timestamp NULL DEFAULT NULL,
  `reconciled_by` int DEFAULT NULL,
  `status` enum('pending','completed','failed','refunded') DEFAULT 'pending',
  `notes` text,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `idx_user` (`user_id`),
  KEY `idx_payments_transaction_source` (`transaction_source`),
  KEY `idx_payments_performed_by_user` (`performed_by_user_id`),
  KEY `payments_ibfk_2` (`location_id`),
  KEY `payments_ibfk_3` (`booking_id`),
  KEY `fk_payment_reconciled` (`reconciled_by`),
  KEY `idx_payments_status_time` (`status`,`payment_time`),
  CONSTRAINT `fk_payment_performed_by` FOREIGN KEY (`performed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_reconciled` FOREIGN KEY (`reconciled_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE RESTRICT,
  CONSTRAINT `payments_ibfk_3` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,15,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":1,\"room_id\":42,\"location_id\":2,\"amount\":42000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 2\",\"checkin_time\":\"2026-02-25T06:54:00.000Z\",\"checkout_time\":\"2026-02-25T06:54:02.131Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000}}','2026-02-25 06:54:02',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:1'),(2,16,2,NULL,84000.00,'onsite_pos',0.00,0.00,0.00,0.00,84000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":2,\"room_id\":41,\"location_id\":2,\"amount\":84000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"minh\",\"guest_phone\":\"01234567789\",\"checkin_time\":\"2026-02-25T11:53:07.000Z\",\"checkout_time\":\"2026-02-25T11:54:40.610Z\",\"room_unit_price\":2500000,\"actual_minutes\":2,\"actual_hours_ceil\":1,\"planned_hours_ceil\":12,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":83333.33,\"items_amount\":0,\"subtotal\":83333.33,\"total_amount\":84000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=84000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":84000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-25 11:54:40',4,'owner','Minh',NULL,NULL,'pending','HOTEL_STAY:2'),(3,17,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":3,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-25T11:55:14.000Z\",\"checkout_time\":\"2026-02-25T11:55:16.564Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000}}','2026-02-25 11:55:16',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:3'),(4,18,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":4,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-25T11:56:24.000Z\",\"checkout_time\":\"2026-02-25T11:56:26.228Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=42000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":42000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-25 11:56:26',4,'owner','Minh',NULL,NULL,'pending','HOTEL_STAY:4'),(5,19,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":5,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-25T11:59:14.000Z\",\"checkout_time\":\"2026-02-25T11:59:31.181Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=42000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":42000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-25 11:59:31',4,'owner','Minh',NULL,NULL,'pending','HOTEL_STAY:5'),(6,20,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":6,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-25T11:59:37.000Z\",\"checkout_time\":\"2026-02-25T11:59:37.736Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=42000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":42000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-25 11:59:37',4,'owner','Minh',NULL,NULL,'pending','HOTEL_STAY:6'),(7,21,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":7,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-25T11:59:45.000Z\",\"checkout_time\":\"2026-02-25T11:59:49.184Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000}}','2026-02-25 11:59:49',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:7'),(8,22,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":8,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn B\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-25T12:00:02.000Z\",\"checkout_time\":\"2026-02-25T12:00:04.070Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000}}','2026-02-25 12:00:04',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:8'),(9,23,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":9,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"La Hoàn\",\"guest_phone\":\"0987654321\",\"checkin_time\":\"2026-02-25T12:15:02.000Z\",\"checkout_time\":\"2026-02-25T12:15:12.540Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000}}','2026-02-25 12:15:12',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:9'),(10,23,2,NULL,39000.00,'onsite_pos',0.00,0.00,0.00,0.00,39000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":10,\"room_id\":45,\"location_id\":2,\"amount\":39000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng3\",\"guest_name\":\"La Hoàn\",\"guest_phone\":\"0987654321\",\"checkin_time\":\"2026-02-25T12:15:02.000Z\",\"checkout_time\":\"2026-02-25T12:15:12.613Z\",\"room_unit_price\":2300000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":38333.33,\"items_amount\":0,\"subtotal\":38333.33,\"total_amount\":39000}}','2026-02-25 12:15:12',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:10'),(11,24,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":11,\"room_id\":41,\"location_id\":2,\"amount\":42000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Hoàn\",\"guest_phone\":\"0987654333\",\"checkin_time\":\"2026-02-25T12:15:29.000Z\",\"checkout_time\":\"2026-02-25T12:16:25.697Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=42000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":42000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-25 12:15:31',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:11'),(12,25,2,NULL,39000.00,'onsite_pos',0.00,0.00,0.00,0.00,39000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":14,\"room_id\":45,\"location_id\":2,\"amount\":39000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng3\",\"guest_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"checkin_time\":\"2026-02-25T12:17:05.000Z\",\"checkout_time\":\"2026-02-25T12:17:07.606Z\",\"room_unit_price\":2300000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":38333.33,\"items_amount\":0,\"subtotal\":38333.33,\"total_amount\":39000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=39000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":39000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-25 12:17:07',4,'owner','Minh',NULL,NULL,'pending','HOTEL_STAY:14'),(13,25,2,NULL,42000.00,'onsite_pos',0.00,0.00,0.00,0.00,42000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":13,\"room_id\":42,\"location_id\":2,\"amount\":42000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 2\",\"guest_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"checkin_time\":\"2026-02-25T12:17:05.000Z\",\"checkout_time\":\"2026-02-25T12:17:33.556Z\",\"room_unit_price\":2500000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":41666.67,\"items_amount\":0,\"subtotal\":41666.67,\"total_amount\":42000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=42000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":42000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-25 12:17:33',4,'owner','Minh',NULL,NULL,'pending','HOTEL_STAY:13'),(14,NULL,1,NULL,37000.00,'onsite_pos',0.00,0.00,0.00,0.00,37000.00,'Cash',NULL,NULL,'2026-02-27 02:30:10',4,'owner','Minh',NULL,NULL,'completed','{\"transaction_source\":\"onsite_pos\",\"service_type\":\"food\",\"location_id\":1,\"location_name\":\"Cafe Trung Nguyên\",\"owner_id\":4,\"owner_name\":\"Minh\",\"booking_id\":null,\"pos_order_id\":4,\"table_id\":23,\"table_name\":\"Bàn 3\",\"voucher_code\":null,\"amount\":37000,\"items\":[{\"service_id\":1,\"service_name\":\"Cafe đen\",\"quantity\":1,\"unit_price\":17000,\"line_total\":17000},{\"service_id\":2,\"service_name\":\"Cafe Sữa\",\"quantity\":1,\"unit_price\":20000,\"line_total\":20000}],\"total_qty\":2,\"performed_by\":{\"role\":\"owner\",\"user_id\":4,\"name\":\"Minh\",\"phone\":null,\"booked_at\":null},\"processed_by\":{\"user_id\":4,\"role\":\"owner\",\"name\":\"Minh\"},\"created_by\":4}'),(15,NULL,1,NULL,17000.00,'onsite_pos',0.00,0.00,0.00,0.00,17000.00,'BankTransfer',NULL,'{\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":17000,\"add_info\":\"Cafe Trung Nguyên - Cảm ơn quý khách\",\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=17000&addInfo=Cafe%20Trung%20Nguy%C3%AAn%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"pos_order_id\":9}','2026-02-27 02:30:46',4,'owner','Minh',NULL,NULL,'completed','{\"transaction_source\":\"onsite_pos\",\"service_type\":\"food\",\"location_id\":1,\"location_name\":\"Cafe Trung Nguyên\",\"owner_id\":4,\"owner_name\":\"Minh\",\"booking_id\":null,\"pos_order_id\":9,\"table_id\":21,\"table_name\":\"Bàn 1\",\"voucher_code\":null,\"amount\":17000,\"items\":[{\"service_id\":1,\"service_name\":\"Cafe đen\",\"quantity\":1,\"unit_price\":17000,\"line_total\":17000}],\"total_qty\":1,\"performed_by\":{\"role\":\"owner\",\"user_id\":4,\"name\":\"Minh\",\"phone\":null,\"booked_at\":null},\"processed_by\":{\"user_id\":4,\"role\":\"owner\",\"name\":\"Minh\"},\"created_by\":4}'),(16,25,2,NULL,4050000.00,'onsite_pos',0.00,0.00,0.00,0.00,4050000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":12,\"room_id\":41,\"location_id\":2,\"amount\":4050000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"checkin_time\":\"2026-02-25T12:17:05.000Z\",\"checkout_time\":\"2026-02-27T02:32:26.428Z\",\"room_unit_price\":100000,\"actual_minutes\":2296,\"actual_hours_ceil\":39,\"planned_hours_ceil\":24,\"overtime_hours\":15,\"surcharge_amount\":150000,\"room_amount\":4050000,\"items_amount\":0,\"subtotal\":4050000,\"total_amount\":4050000}}','2026-02-27 02:32:26',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:12'),(17,25,2,NULL,4050000.00,'onsite_pos',0.00,0.00,0.00,0.00,4050000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":13,\"room_id\":42,\"location_id\":2,\"amount\":4050000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 2\",\"guest_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"checkin_time\":\"2026-02-25T12:17:05.000Z\",\"checkout_time\":\"2026-02-27T02:32:26.530Z\",\"room_unit_price\":100000,\"actual_minutes\":2296,\"actual_hours_ceil\":39,\"planned_hours_ceil\":24,\"overtime_hours\":15,\"surcharge_amount\":150000,\"room_amount\":4050000,\"items_amount\":0,\"subtotal\":4050000,\"total_amount\":4050000}}','2026-02-27 02:32:26',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:13'),(18,25,2,NULL,4050000.00,'onsite_pos',0.00,0.00,0.00,0.00,4050000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":14,\"room_id\":45,\"location_id\":2,\"amount\":4050000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng3\",\"guest_name\":\"Văn A\",\"guest_phone\":\"0971265389\",\"checkin_time\":\"2026-02-25T12:17:05.000Z\",\"checkout_time\":\"2026-02-27T02:32:26.597Z\",\"room_unit_price\":100000,\"actual_minutes\":2296,\"actual_hours_ceil\":39,\"planned_hours_ceil\":24,\"overtime_hours\":15,\"surcharge_amount\":150000,\"room_amount\":4050000,\"items_amount\":0,\"subtotal\":4050000,\"total_amount\":4050000}}','2026-02-27 02:32:26',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:14'),(19,26,2,NULL,2000.00,'onsite_pos',0.00,0.00,0.00,0.00,2000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":15,\"room_id\":42,\"location_id\":2,\"amount\":2000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 2\",\"guest_name\":\"anh an\",\"guest_phone\":\"0123456787\",\"checkin_time\":\"2026-02-27T02:32:54.000Z\",\"checkout_time\":\"2026-02-27T02:33:00.907Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":1666.67,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=2000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":2000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-27 02:32:56',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:15'),(20,26,2,NULL,2000.00,'onsite_pos',0.00,0.00,0.00,0.00,2000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":16,\"room_id\":45,\"location_id\":2,\"amount\":2000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng3\",\"guest_name\":\"anh an\",\"guest_phone\":\"0123456787\",\"checkin_time\":\"2026-02-27T02:32:54.000Z\",\"checkout_time\":\"2026-02-27T02:33:06.646Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":1666.67,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=2000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":2000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-27 02:33:05',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:16'),(21,NULL,1,NULL,17000.00,'onsite_pos',0.00,0.00,0.00,0.00,17000.00,'BankTransfer',NULL,'{\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":17000,\"add_info\":\"Cafe Trung Nguyên - Cảm ơn quý khách\",\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=17000&addInfo=Cafe%20Trung%20Nguy%C3%AAn%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"pos_order_id\":10}','2026-02-27 02:37:18',4,'owner','Minh',NULL,NULL,'completed','{\"transaction_source\":\"onsite_pos\",\"service_type\":\"food\",\"location_id\":1,\"location_name\":\"Cafe Trung Nguyên\",\"owner_id\":4,\"owner_name\":\"Minh\",\"booking_id\":null,\"pos_order_id\":10,\"table_id\":21,\"table_name\":\"Bàn 1\",\"voucher_code\":null,\"amount\":17000,\"items\":[{\"service_id\":1,\"service_name\":\"Cafe đen\",\"quantity\":1,\"unit_price\":17000,\"line_total\":17000}],\"total_qty\":1,\"performed_by\":{\"role\":\"owner\",\"user_id\":4,\"name\":\"Minh\",\"phone\":null,\"booked_at\":null},\"processed_by\":{\"user_id\":4,\"role\":\"owner\",\"name\":\"Minh\"},\"created_by\":4}'),(22,27,2,NULL,2000.00,'onsite_pos',0.00,0.00,0.00,0.00,2000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":18,\"room_id\":42,\"location_id\":2,\"amount\":2000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 2\",\"guest_name\":\"Văn An\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-27T03:40:52.000Z\",\"checkout_time\":\"2026-02-27T03:41:04.260Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":12,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":1666.67,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000}}','2026-02-27 03:41:04',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:18'),(23,27,2,NULL,2000.00,'onsite_pos',0.00,0.00,0.00,0.00,2000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":17,\"room_id\":41,\"location_id\":2,\"amount\":2000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn An\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-27T03:40:52.000Z\",\"checkout_time\":\"2026-02-27T03:41:40.883Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":12,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":1666.67,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000}}','2026-02-27 03:41:40',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:17'),(24,28,2,NULL,2000.00,'onsite_pos',0.00,0.00,0.00,0.00,2000.00,'Cash',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":19,\"room_id\":42,\"location_id\":2,\"amount\":2000,\"method\":\"cash\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 2\",\"guest_name\":\"Văn An\",\"guest_phone\":\"0123456789\",\"checkin_time\":\"2026-02-27T03:41:35.000Z\",\"checkout_time\":\"2026-02-27T03:41:40.967Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":12,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":1666.67,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000}}','2026-02-27 03:41:40',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAY:19'),(25,29,2,NULL,2000.00,'onsite_pos',0.00,0.00,0.00,0.00,2000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT\",\"stay_id\":21,\"room_id\":42,\"location_id\":2,\"amount\":2000,\"method\":\"transfer\",\"hotel_invoice\":{\"payment_id\":null,\"location_name\":\"Nhà Trọ Phú Mỹ\",\"owner_name\":\"Minh\",\"room_number\":\"Phòng 2\",\"guest_name\":\"Văn An\",\"guest_phone\":\"0123456565\",\"checkin_time\":\"2026-02-27T03:42:00.000Z\",\"checkout_time\":\"2026-02-27T03:42:01.991Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"actual_hours_ceil\":1,\"planned_hours_ceil\":24,\"overtime_hours\":0,\"surcharge_amount\":0,\"room_amount\":1666.67,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000},\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=2000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":2000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-27 03:42:01',4,'owner','Minh',NULL,NULL,'pending','HOTEL_STAY:21'),(26,NULL,2,NULL,4000.00,'onsite_pos',0.00,0.00,0.00,0.00,4000.00,'BankTransfer',NULL,'{\"content\":\"HOTEL_CHECKOUT_BATCH\",\"stay_ids\":[20,21],\"location_id\":2,\"amount\":4000,\"method\":\"transfer\",\"hotel_invoices\":[{\"stay_id\":20,\"room_id\":41,\"room_number\":\"Phòng 1\",\"guest_name\":\"Văn An\",\"guest_phone\":\"0123456565\",\"checkin_time\":\"2026-02-27T03:42:00.000Z\",\"checkout_time\":\"2026-02-27T03:42:32.945Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"overtime_hours\":0,\"surcharge_amount\":0,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000},{\"stay_id\":21,\"room_id\":42,\"room_number\":\"Phòng 2\",\"guest_name\":\"Văn An\",\"guest_phone\":\"0123456565\",\"checkin_time\":\"2026-02-27T03:42:00.000Z\",\"checkout_time\":\"2026-02-27T03:42:32.945Z\",\"room_unit_price\":100000,\"actual_minutes\":1,\"overtime_hours\":0,\"surcharge_amount\":0,\"items_amount\":0,\"subtotal\":1666.67,\"total_amount\":2000}],\"bank\":{\"qr_code_url\":\"https://img.vietqr.io/image/970436-1030549759-qr_only.png?amount=4000&addInfo=Nh%C3%A0%20Tr%E1%BB%8D%20Ph%C3%BA%20M%E1%BB%B9%20-%20C%E1%BA%A3m%20%C6%A1n%20qu%C3%BD%20kh%C3%A1ch\",\"bank_name\":\"Vietcombank\",\"bank_account\":\"1030549759\",\"account_holder\":\"Minh\",\"bank_bin\":\"970436\",\"amount\":4000,\"note\":\"Nhà Trọ Phú Mỹ - Cảm ơn quý khách\"}}','2026-02-27 03:42:08',4,'owner','Minh',NULL,NULL,'completed','HOTEL_STAYS:20,21');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pos_areas`
--

DROP TABLE IF EXISTS `pos_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_areas` (
  `area_id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `area_name` varchar(100) NOT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`area_id`),
  UNIQUE KEY `uniq_area_per_location` (`location_id`,`area_name`),
  KEY `idx_pos_areas_location` (`location_id`),
  CONSTRAINT `pos_areas_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pos_areas`
--

LOCK TABLES `pos_areas` WRITE;
/*!40000 ALTER TABLE `pos_areas` DISABLE KEYS */;
INSERT INTO `pos_areas` VALUES (1,1,'Tầng 1',1,'2026-02-03 18:16:30'),(2,1,'Tầng 2',2,'2026-02-03 19:18:30');
/*!40000 ALTER TABLE `pos_areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pos_order_items`
--

DROP TABLE IF EXISTS `pos_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_order_items` (
  `order_item_id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `service_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(15,2) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_item_id`),
  KEY `idx_pos_items_order` (`order_id`),
  KEY `pos_order_items_fk_service` (`service_id`),
  CONSTRAINT `pos_order_items_fk_order` FOREIGN KEY (`order_id`) REFERENCES `pos_orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `pos_order_items_fk_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pos_order_items`
--

LOCK TABLES `pos_order_items` WRITE;
/*!40000 ALTER TABLE `pos_order_items` DISABLE KEYS */;
INSERT INTO `pos_order_items` VALUES (8,2,1,1,17000.00,17000.00,'2026-02-04 11:00:49'),(9,3,1,1,17000.00,17000.00,'2026-02-04 11:00:55'),(10,4,1,1,17000.00,17000.00,'2026-02-05 04:38:49'),(11,4,2,1,20000.00,20000.00,'2026-02-05 04:38:50'),(12,9,1,1,17000.00,17000.00,'2026-02-27 02:30:14'),(13,10,1,1,17000.00,17000.00,'2026-02-27 02:33:20');
/*!40000 ALTER TABLE `pos_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pos_orders`
--

DROP TABLE IF EXISTS `pos_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_orders` (
  `order_id` bigint NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `table_id` int DEFAULT NULL,
  `status` enum('open','paid','cancelled') NOT NULL DEFAULT 'open',
  `order_source` enum('online_booking','onsite_pos') NOT NULL DEFAULT 'onsite_pos',
  `subtotal_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `final_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`),
  KEY `idx_pos_orders_location_status` (`location_id`,`status`),
  KEY `idx_pos_orders_table_status` (`table_id`,`status`),
  KEY `pos_orders_fk_created_by` (`created_by`),
  KEY `pos_orders_fk_closed_by` (`closed_by`),
  CONSTRAINT `pos_orders_fk_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `pos_orders_fk_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `pos_orders_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `pos_orders_fk_table` FOREIGN KEY (`table_id`) REFERENCES `pos_tables` (`table_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pos_orders`
--

LOCK TABLES `pos_orders` WRITE;
/*!40000 ALTER TABLE `pos_orders` DISABLE KEYS */;
INSERT INTO `pos_orders` VALUES (1,1,41,'open','onsite_pos',0.00,0.00,0.00,4,NULL,'2026-02-04 10:01:32','2026-02-04 10:45:19'),(2,1,22,'paid','onsite_pos',17000.00,0.00,17000.00,4,4,'2026-02-04 11:00:35','2026-02-04 11:00:52'),(3,1,21,'paid','onsite_pos',17000.00,0.00,17000.00,4,4,'2026-02-04 11:00:44','2026-02-04 11:00:57'),(4,1,23,'paid','onsite_pos',37000.00,0.00,37000.00,4,4,'2026-02-04 11:09:41','2026-02-27 02:30:10'),(5,1,29,'open','onsite_pos',0.00,0.00,0.00,4,NULL,'2026-02-04 11:09:51','2026-02-04 11:09:51'),(6,1,28,'open','onsite_pos',0.00,0.00,0.00,4,NULL,'2026-02-04 11:09:52','2026-02-04 11:09:52'),(7,1,22,'open','onsite_pos',0.00,0.00,0.00,4,NULL,'2026-02-04 11:09:52','2026-02-04 11:09:52'),(8,1,24,'open','onsite_pos',0.00,0.00,0.00,4,NULL,'2026-02-04 11:20:32','2026-02-04 11:20:32'),(9,1,21,'paid','onsite_pos',17000.00,0.00,17000.00,4,4,'2026-02-27 02:30:13','2026-02-27 02:30:46'),(10,1,21,'paid','onsite_pos',17000.00,0.00,17000.00,4,4,'2026-02-27 02:30:50','2026-02-27 02:37:18');
/*!40000 ALTER TABLE `pos_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pos_tables`
--

DROP TABLE IF EXISTS `pos_tables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_tables` (
  `table_id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `area_id` int DEFAULT NULL,
  `table_name` varchar(50) NOT NULL,
  `shape` enum('square','round') DEFAULT 'square',
  `pos_x` int DEFAULT NULL,
  `pos_y` int DEFAULT NULL,
  `status` enum('free','occupied','reserved') NOT NULL DEFAULT 'free',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`table_id`),
  UNIQUE KEY `uniq_table_per_location` (`location_id`,`table_name`),
  KEY `idx_pos_tables_location_area` (`location_id`,`area_id`),
  KEY `pos_tables_fk_area` (`area_id`),
  CONSTRAINT `pos_tables_fk_area` FOREIGN KEY (`area_id`) REFERENCES `pos_areas` (`area_id`) ON DELETE SET NULL,
  CONSTRAINT `pos_tables_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pos_tables`
--

LOCK TABLES `pos_tables` WRITE;
/*!40000 ALTER TABLE `pos_tables` DISABLE KEYS */;
INSERT INTO `pos_tables` VALUES (21,1,1,'Bàn 1','square',12,12,'free','2026-02-03 18:28:56','2026-02-27 02:37:18'),(22,1,1,'Bàn 2','square',146,12,'occupied','2026-02-03 18:28:56','2026-02-04 11:09:52'),(23,1,1,'Bàn 3','square',280,12,'free','2026-02-03 18:28:56','2026-02-27 02:30:10'),(24,1,1,'Bàn 4','square',414,12,'free','2026-02-03 18:28:56','2026-02-03 18:28:56'),(25,1,1,'Bàn 5','square',548,12,'free','2026-02-03 18:28:56','2026-02-03 18:28:56'),(26,1,1,'Bàn 6','square',682,12,'free','2026-02-03 18:28:56','2026-02-03 18:28:56'),(27,1,1,'Bàn 7','square',12,104,'free','2026-02-03 18:28:56','2026-02-03 18:28:56'),(28,1,1,'Bàn 8','square',146,104,'occupied','2026-02-03 18:28:56','2026-02-04 11:09:52'),(29,1,1,'Bàn 9','square',280,104,'occupied','2026-02-03 18:28:56','2026-02-04 11:09:51'),(30,1,1,'Bàn 10','square',414,104,'free','2026-02-03 18:28:56','2026-02-03 18:28:56'),(41,1,2,'Bàn 11','square',12,12,'occupied','2026-02-03 19:19:36','2026-02-04 10:01:32'),(42,1,2,'Bàn 12','square',146,12,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(43,1,2,'Bàn 13','square',280,12,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(44,1,2,'Bàn 14','square',414,12,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(45,1,2,'Bàn 15','square',548,12,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(46,1,2,'Bàn 16','square',682,12,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(47,1,2,'Bàn 17','square',12,104,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(48,1,2,'Bàn 18','square',146,104,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(49,1,2,'Bàn 19','square',280,104,'free','2026-02-03 19:19:36','2026-02-03 19:19:36'),(50,1,2,'Bàn 20','square',414,104,'free','2026-02-03 19:19:36','2026-02-03 19:19:36');
/*!40000 ALTER TABLE `pos_tables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pos_tickets`
--

DROP TABLE IF EXISTS `pos_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_tickets` (
  `pos_ticket_id` bigint NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `service_id` int NOT NULL,
  `ticket_code` varchar(64) NOT NULL,
  `status` enum('unused','used','void') NOT NULL DEFAULT 'unused',
  `sold_by` int DEFAULT NULL,
  `sold_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `used_at` timestamp NULL DEFAULT NULL,
  `used_by` int DEFAULT NULL,
  PRIMARY KEY (`pos_ticket_id`),
  UNIQUE KEY `uniq_pos_ticket_code` (`ticket_code`),
  KEY `idx_pos_ticket_location_status` (`location_id`,`status`),
  KEY `pos_tickets_fk_service` (`service_id`),
  KEY `pos_tickets_fk_sold_by` (`sold_by`),
  KEY `pos_tickets_fk_used_by` (`used_by`),
  CONSTRAINT `pos_tickets_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `pos_tickets_fk_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `pos_tickets_fk_sold_by` FOREIGN KEY (`sold_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `pos_tickets_fk_used_by` FOREIGN KEY (`used_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pos_tickets`
--

LOCK TABLES `pos_tickets` WRITE;
/*!40000 ALTER TABLE `pos_tickets` DISABLE KEYS */;
INSERT INTO `pos_tickets` VALUES (1,3,7,'PT-3-7-20260205-122121-e399fe','unused',NULL,'2026-02-05 05:21:21',NULL,NULL),(2,3,7,'PT-3-7-20260205-122946-b3b390','unused',NULL,'2026-02-05 05:29:46',NULL,NULL),(3,3,7,'PT-3-7-20260205-122946-8d0746','unused',NULL,'2026-02-05 05:29:46',NULL,NULL),(4,3,7,'PT-3-7-20260205-122946-1166c9','unused',NULL,'2026-02-05 05:29:46',NULL,NULL),(5,3,8,'PT-3-8-20260205-122946-47196c','unused',NULL,'2026-02-05 05:29:46',NULL,NULL);
/*!40000 ALTER TABLE `pos_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_notifications`
--

DROP TABLE IF EXISTS `push_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `target_audience` varchar(50) NOT NULL COMMENT 'all_users, all_owners, specific_user',
  `target_user_id` int DEFAULT NULL,
  `sent_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_push_target_user` (`target_user_id`),
  KEY `push_notifications_sender_fk` (`sent_by`),
  CONSTRAINT `push_notifications_sender_fk` FOREIGN KEY (`sent_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `push_notifications_target_user_fk` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_notifications`
--

LOCK TABLES `push_notifications` WRITE;
/*!40000 ALTER TABLE `push_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `push_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports`
--

DROP TABLE IF EXISTS `reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `reporter_id` int NOT NULL,
  `reported_user_id` int DEFAULT NULL,
  `reported_location_id` int DEFAULT NULL,
  `reported_review_id` int DEFAULT NULL,
  `report_type` enum('spam','inappropriate','fraud','other') NOT NULL,
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `description` text NOT NULL,
  `status` enum('pending','reviewing','resolved','rejected') DEFAULT 'pending',
  `resolved_by` int DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolution_notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  KEY `idx_reporter` (`reporter_id`),
  KEY `idx_reported_user` (`reported_user_id`),
  KEY `idx_reported_location` (`reported_location_id`),
  KEY `idx_reported_review` (`reported_review_id`),
  KEY `idx_resolved_by` (`resolved_by`),
  KEY `idx_reports_severity` (`severity`),
  CONSTRAINT `reports_reported_location_fk` FOREIGN KEY (`reported_location_id`) REFERENCES `locations` (`location_id`) ON DELETE SET NULL,
  CONSTRAINT `reports_reported_review_fk` FOREIGN KEY (`reported_review_id`) REFERENCES `reviews` (`review_id`) ON DELETE SET NULL,
  CONSTRAINT `reports_reported_user_fk` FOREIGN KEY (`reported_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `reports_reporter_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `reports_resolved_by_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `review_replies`
--

DROP TABLE IF EXISTS `review_replies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `review_replies` (
  `reply_id` int NOT NULL AUTO_INCREMENT,
  `review_id` int NOT NULL,
  `content` text NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`reply_id`),
  UNIQUE KEY `unique_review_reply` (`review_id`),
  KEY `review_replies_created_by_fk` (`created_by`),
  CONSTRAINT `review_replies_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `review_replies_review_fk` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`review_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `review_replies`
--

LOCK TABLES `review_replies` WRITE;
/*!40000 ALTER TABLE `review_replies` DISABLE KEYS */;
/*!40000 ALTER TABLE `review_replies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `review_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `location_id` int NOT NULL,
  `booking_id` int DEFAULT NULL,
  `rating` decimal(2,1) NOT NULL,
  `comment` text,
  `images` json DEFAULT NULL,
  `status` enum('active','hidden','deleted') DEFAULT 'active',
  `hidden_by` int DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`review_id`),
  KEY `idx_location` (`location_id`),
  KEY `idx_reviews_deleted_at` (`deleted_at`),
  KEY `idx_reviews_deleted_by` (`deleted_by`),
  KEY `reviews_ibfk_1` (`user_id`),
  KEY `reviews_ibfk_3` (`booking_id`),
  CONSTRAINT `reviews_deleted_by_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_ibfk_3` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL,
  CONSTRAINT `reviews_chk_1` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_categories`
--

DROP TABLE IF EXISTS `service_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `category_type` enum('menu','room','other') NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `uniq_service_category` (`location_id`,`category_type`,`category_name`),
  KEY `idx_service_categories_location` (`location_id`,`category_type`),
  KEY `idx_service_categories_deleted_at` (`deleted_at`),
  CONSTRAINT `service_categories_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_categories`
--

LOCK TABLES `service_categories` WRITE;
/*!40000 ALTER TABLE `service_categories` DISABLE KEYS */;
INSERT INTO `service_categories` VALUES (1,1,'menu','Cafe',1,'2026-02-03 17:08:23','2026-02-03 17:08:23',NULL),(2,1,'menu','Trà',2,'2026-02-03 17:08:31','2026-02-03 17:08:31',NULL),(3,2,'room','Tầng trệt',1,'2026-02-03 17:13:20','2026-02-03 17:13:20',NULL),(4,3,'other','Vé Người Lớn',1,'2026-02-03 17:14:32','2026-02-03 17:14:32',NULL),(5,3,'other','Vé Trẻ Em',2,'2026-02-03 17:14:40','2026-02-03 17:14:40',NULL),(6,2,'room','Tầng 2',2,'2026-02-04 07:15:33','2026-02-04 07:17:22',NULL),(8,1,'menu','Bánh Ngọt',3,'2026-02-04 11:20:57','2026-02-04 11:20:57',NULL);
/*!40000 ALTER TABLE `service_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `service_id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `category_id` int DEFAULT NULL,
  `service_name` varchar(255) NOT NULL,
  `service_type` enum('room','table','ticket','food','combo','other') NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `quantity` int DEFAULT '1',
  `unit` varchar(50) DEFAULT NULL,
  `status` enum('available','booked','unavailable','reserved') DEFAULT 'available',
  `images` json DEFAULT NULL,
  `admin_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_reviewed_by` int DEFAULT NULL,
  `admin_reviewed_at` timestamp NULL DEFAULT NULL,
  `admin_reject_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pos_group` varchar(50) DEFAULT NULL,
  `pos_sort` int DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`service_id`),
  KEY `idx_location` (`location_id`),
  KEY `idx_services_category` (`category_id`),
  KEY `idx_services_admin_status` (`admin_status`),
  KEY `idx_services_admin_reviewed_by` (`admin_reviewed_by`),
  KEY `idx_services_deleted_at` (`deleted_at`),
  CONSTRAINT `services_fk_admin_reviewed_by` FOREIGN KEY (`admin_reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `services_fk_category` FOREIGN KEY (`category_id`) REFERENCES `service_categories` (`category_id`) ON DELETE SET NULL,
  CONSTRAINT `services_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
INSERT INTO `services` VALUES (1,1,1,'Cafe đen','food',NULL,17000.00,1,'Ly','available','[\"/uploads/services/service-4-1770138525156-fe5ffb2aad0e.jpg\"]','approved',1,'2026-02-03 17:52:06',NULL,'2026-02-03 17:08:56','2026-02-03 17:52:06','Cafe',NULL,NULL),(2,1,1,'Cafe Sữa','food',NULL,20000.00,1,'Ly','available','[\"/uploads/services/service-4-1770138544156-dd278575e0e1.jpg\"]','approved',1,'2026-02-03 17:52:06',NULL,'2026-02-03 17:09:30','2026-02-03 17:52:06','Cafe',NULL,NULL),(3,1,2,'Trà Đào','food',NULL,23000.00,1,'Ly','available','[\"/uploads/services/service-4-1770138590078-5c2d6b9234cc.png\"]','approved',1,'2026-02-03 17:52:06',NULL,'2026-02-03 17:10:05','2026-02-03 17:52:06','Trà',NULL,NULL),(4,1,1,'Combo đi làm','combo','chỉ với 35k bạn sẽ được 1 bữa sáng ngon miệng',35000.00,1,'Phần','available','[\"/uploads/services/service-4-1770138620805-5dbfff48e9d6.jpg\"]','approved',1,'2026-02-03 17:52:06',NULL,'2026-02-03 17:11:04','2026-02-03 17:52:06','Cafe',NULL,NULL),(5,2,3,'Phòng 1','room',NULL,100000.00,1,'Tiếng','available','[\"/uploads/services/service-4-1770138817540-8ba4e25d35fe.jpg\"]','approved',1,'2026-02-27 03:40:24',NULL,'2026-02-03 17:13:55','2026-02-27 03:40:24','Tầng trệt',NULL,NULL),(6,2,3,'Phòng 2','room',NULL,100000.00,1,'Tiếng','available','[\"/uploads/services/service-4-1770138862528-57a00ac0c7e8.jpg\"]','approved',1,'2026-02-27 03:40:24',NULL,'2026-02-03 17:14:26','2026-02-27 03:40:24','Tầng trệt',NULL,NULL),(7,3,4,'Vé Người Lớn','ticket',NULL,100000.00,1000,'Vé','available','[\"/uploads/services/service-4-1770138895174-751ff3d9ef50.jpg\"]','approved',1,'2026-02-03 17:52:06',NULL,'2026-02-03 17:15:06','2026-02-03 17:52:06','Vé Người Lớn',NULL,NULL),(8,3,5,'Vé Trẻ Em','ticket',NULL,50000.00,500,'Vé','available','[\"/uploads/services/service-4-1770138914751-85503641ffa6.png\"]','approved',1,'2026-02-03 17:52:06',NULL,'2026-02-03 17:15:34','2026-02-03 17:52:06','Vé Trẻ Em',NULL,NULL),(11,2,6,'Phòng3','room',NULL,100000.00,1,'Tiếng','available','[\"/uploads/services/service-4-1770189532158-a1b34c72648d.jpg\"]','approved',1,'2026-02-27 03:40:24',NULL,'2026-02-04 07:17:53','2026-02-27 03:40:24','Tầng 2',NULL,NULL),(12,2,6,'Phòng4','room',NULL,100000.00,1,'Tiếng','available','[\"/uploads/services/service-4-1770189542024-7f8fa8c38ce8.jpg\"]','approved',1,'2026-02-27 03:40:24',NULL,'2026-02-04 07:17:53','2026-02-27 03:40:24','Tầng 2',NULL,NULL),(13,2,6,'Phòng5','room',NULL,100000.00,1,'Tiếng','available','[\"/uploads/services/service-4-1770189549590-039655050af5.jpg\"]','approved',1,'2026-02-27 03:40:24',NULL,'2026-02-04 07:17:53','2026-02-27 03:40:24','Tầng 2',NULL,NULL),(14,2,6,'Phòng6','room',NULL,100000.00,1,'Tiếng','available','[\"/uploads/services/service-4-1770189555726-2d27ebd6bd29.jpg\"]','approved',1,'2026-02-27 03:40:24',NULL,'2026-02-04 07:17:53','2026-02-27 03:40:24','Tầng 2',NULL,NULL),(15,1,8,'Bánh cheesecake Chanh Dây Phô Mai','food',NULL,100000.00,1,'Phần','available','[\"/uploads/services/service-4-1770204076202-7de68a092498.png\"]','approved',1,'2026-02-04 11:24:15',NULL,'2026-02-04 11:21:34','2026-02-04 11:24:15','Bánh Ngọt',NULL,NULL),(16,1,8,'Bánh Sừng Trâu','food',NULL,8000.00,1,'Cái','available','[\"/uploads/services/service-4-1770204136123-d79c0486ee07.jpg\"]','approved',1,'2026-02-04 11:24:15',NULL,'2026-02-04 11:22:44','2026-02-04 11:24:15','Bánh Ngọt',NULL,NULL),(17,1,1,'Cafe Cam','food',NULL,15000.00,1,'Ly','available','[\"/uploads/services/service-4-1770204174545-16c353aeb017.jpg\"]','approved',1,'2026-02-04 11:24:15',NULL,'2026-02-04 11:23:11','2026-02-04 11:24:15','Cafe',NULL,NULL),(18,1,8,'tiramisu','food',NULL,19000.00,1,'Cái','available','[\"/uploads/services/service-4-1770204206208-fb46c5231bb6.png\"]','approved',1,'2026-02-04 11:24:15',NULL,'2026-02-04 11:23:38','2026-02-04 11:24:15','Bánh Ngọt',NULL,NULL);
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sos_alerts`
--

DROP TABLE IF EXISTS `sos_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sos_alerts` (
  `alert_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `location_coordinates` point DEFAULT NULL,
  `location_text` text,
  `message` text,
  `status` enum('pending','processing','resolved') DEFAULT 'pending',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`alert_id`),
  KEY `idx_status` (`status`),
  KEY `sos_alerts_ibfk_1` (`user_id`),
  CONSTRAINT `sos_alerts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sos_alerts`
--

LOCK TABLES `sos_alerts` WRITE;
/*!40000 ALTER TABLE `sos_alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `sos_alerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `setting_value_file` varchar(255) DEFAULT NULL,
  `setting_type` enum('text','image','json') DEFAULT 'text',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `image_source` enum('upload','url') DEFAULT 'url',
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES ('admin_bank_account','05012004',NULL,'text','2026-02-03 16:54:47','url'),('admin_bank_bin',NULL,NULL,'text','2026-02-03 16:54:47','url'),('admin_bank_contact_info',NULL,NULL,'text','2026-02-03 16:54:47','url'),('admin_bank_holder','Admin',NULL,'text','2026-02-03 16:54:47','url'),('admin_bank_name','Eximbank',NULL,'text','2026-02-03 16:54:47','url');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_diary`
--

DROP TABLE IF EXISTS `user_diary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_diary` (
  `diary_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `location_id` int DEFAULT NULL,
  `images` json DEFAULT NULL,
  `mood` enum('happy','excited','neutral','sad','angry','tired') DEFAULT 'happy',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`diary_id`),
  KEY `user_diary_ibfk_1` (`user_id`),
  KEY `user_diary_ibfk_2` (`location_id`),
  CONSTRAINT `user_diary_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `user_diary_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_diary`
--

LOCK TABLES `user_diary` WRITE;
/*!40000 ALTER TABLE `user_diary` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_diary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_preferences`
--

DROP TABLE IF EXISTS `user_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_preferences` (
  `user_id` int NOT NULL,
  `personality` varchar(50) DEFAULT 'friendly',
  `travel_style` json DEFAULT NULL COMMENT '["foodie","adventure","relax","culture"]',
  `budget_range` varchar(50) DEFAULT NULL,
  `preferred_locations` json DEFAULT NULL,
  `dislikes` json DEFAULT NULL,
  `chat_preference` varchar(50) DEFAULT 'casual',
  `ai_profile` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ai_model` varchar(50) DEFAULT 'gpt-4o-mini',
  `ai_profile_version` int DEFAULT '1',
  `ai_last_updated` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_preferences`
--

LOCK TABLES `user_preferences` WRITE;
/*!40000 ALTER TABLE `user_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) NOT NULL,
  `avatar_url` text,
  `avatar_path` varchar(255) DEFAULT NULL,
  `avatar_source` enum('upload','url') DEFAULT 'url',
  `role` enum('user','owner','employee','admin') DEFAULT 'user',
  `admin_type` enum('system','support') DEFAULT NULL,
  `status` enum('active','pending','locked') DEFAULT 'active',
  `is_verified` tinyint(1) DEFAULT '0',
  `google_id` varchar(255) DEFAULT NULL,
  `facebook_id` varchar(255) DEFAULT NULL,
  `refresh_token` text,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `avatar_updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_phone` (`phone`),
  KEY `idx_role` (`role`),
  KEY `idx_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'minhmap3367@gmail.com','0869378427',NULL,'Mai Nhựt Minh',NULL,'/uploads/avatars/avatar-1-1770136267845-28dd48cff1d2.jpg','upload','admin',NULL,'active',1,'110437839771793851495',NULL,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc3MjAyMDQyMCwiZXhwIjoxNzc0NjEyNDIwfQ.3iwDSBaLBN_8rbY9zxnDQBjd-Ezu3cryj1rn_v4qsrI',NULL,'2026-01-20 12:35:54','2026-02-25 11:53:40',NULL,NULL),(4,'memory3367@gmail.com','0869378422',NULL,'Minh','https://cdn-media.sforum.vn/storage/app/media/ctvseo_maihue/hinh-nen-1920-1080/hinh-nen-1920-1080-thumbnail.jpg','/uploads/avatars/avatar-4-1769754088268-dd70a7a58220.png','upload','owner',NULL,'active',1,'115224012803629970659',NULL,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImlhdCI6MTc3MDE5MTA1MywiZXhwIjoxNzcyNzgzMDUzfQ.YyhFBydiQEn9XSCLKUeT1TEkBEpHNwyCeS2ORet2WRw',NULL,'2026-01-20 14:50:12','2026-02-04 07:44:13',NULL,'2026-01-30 06:21:28'),(8,'sathuonline0788746659@gmail.com',NULL,NULL,'Nhựt Minh',NULL,'/uploads/avatars/avatar-8-1770052786105-37137d1b5ced.png','upload','user',NULL,'active',1,'118417830643697148166',NULL,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjgsImlhdCI6MTc3MDE5MDczOSwiZXhwIjoxNzcyNzgyNzM5fQ.1LLJO_4ECGFgINC3dkeCliw8J1r8pWHvcWvNzJFlRFI',NULL,'2026-02-02 16:54:52','2026-02-04 07:38:59',NULL,'2026-02-02 17:19:46'),(9,'NVA@gmail.com','0123456789','$2b$10$vTwPPfx1hPphhoDkvpLs5OwWJ9PX9MfNworgmp0dIKdmEsbs11Kcq','Nguyễn Văn A',NULL,NULL,'url','employee',NULL,'active',1,NULL,NULL,NULL,NULL,'2026-02-04 06:19:33','2026-02-04 06:19:33',NULL,NULL),(10,'NVB@gmail.com','0123456788','$2b$10$Iul9I0vvWOzgHG/T8CKSMOJuSYbA04B5orxeeR03jZt9GnyVyWs7e','Nguyễn Văn B',NULL,NULL,'url','employee',NULL,'active',1,NULL,NULL,NULL,NULL,'2026-02-04 06:20:08','2026-02-04 06:20:08',NULL,NULL),(11,'NVC@gmail.com','0123456787','$2b$10$Fp37Jwp9SQ.a1QQP8gkOue1f.K5LHgfwqufoxZ9/h1uFKfR1zst4q','Nguyễn Văn BC',NULL,NULL,'url','employee',NULL,'active',1,NULL,NULL,NULL,NULL,'2026-02-04 06:20:54','2026-02-04 06:20:54',NULL,NULL),(12,'NVD@gmail.com','0123456776','$2b$10$ya0l8qWX.1tfIm6RzOmyTeI9jzQ4/pfkcVza.wO.FgjNQrYprloZi','Nguyễn Văn D',NULL,NULL,'url','employee',NULL,'active',1,NULL,NULL,NULL,NULL,'2026-02-04 06:21:34','2026-02-04 06:21:34',NULL,NULL),(13,'NVE@gmail.com','0123456775','$2b$10$kabCwmZBWdDOAaEoOXMmMOPLKTpSElAUYFRgtCzytLQkSz9KTQydq','Nguyễn Văn E',NULL,NULL,'url','employee',NULL,'active',1,NULL,NULL,NULL,NULL,'2026-02-04 06:22:13','2026-02-04 06:22:13',NULL,NULL),(14,'NVF@gmail.com','0123456774','$2b$10$Y3EzOKoFLykg2yJwLqf3rOOo5OzPqrB6b7Zgfbehw.qetPmPHTQjW','Nguyễn Văn F',NULL,NULL,'url','employee',NULL,'active',1,NULL,NULL,NULL,NULL,'2026-02-04 06:22:36','2026-02-04 06:22:36',NULL,NULL),(15,NULL,'k',NULL,'k',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 06:53:59','2026-02-25 06:53:59',NULL,NULL),(16,NULL,'01234567789',NULL,'minh',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 11:53:06','2026-02-25 11:53:06',NULL,NULL),(17,NULL,'0123456789',NULL,'Văn B',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 11:55:14','2026-02-25 11:55:14',NULL,NULL),(18,NULL,'0123456789',NULL,'Văn B',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 11:56:24','2026-02-25 11:56:24',NULL,NULL),(19,NULL,'0123456789',NULL,'Văn B',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 11:59:13','2026-02-25 11:59:13',NULL,NULL),(20,NULL,'0123456789',NULL,'Văn B',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 11:59:36','2026-02-25 11:59:36',NULL,NULL),(21,NULL,'0123456789',NULL,'Văn B',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 11:59:44','2026-02-25 11:59:44',NULL,NULL),(22,NULL,'0123456789',NULL,'Văn B',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 12:00:02','2026-02-25 12:00:02',NULL,NULL),(23,NULL,'0987654321',NULL,'La Hoàn',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 12:15:01','2026-02-25 12:15:01',NULL,NULL),(24,NULL,'0987654333',NULL,'Hoàn',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 12:15:29','2026-02-25 12:15:29',NULL,NULL),(25,NULL,'0971265389',NULL,'Văn A',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-25 12:17:04','2026-02-25 12:17:04',NULL,NULL),(26,NULL,'0123456787',NULL,'anh an',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-27 02:32:54','2026-02-27 02:32:54',NULL,NULL),(27,NULL,'0123456789',NULL,'Văn An',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-27 03:40:51','2026-02-27 03:40:51',NULL,NULL),(28,NULL,'0123456789',NULL,'Văn An',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-27 03:41:35','2026-02-27 03:41:35',NULL,NULL),(29,NULL,'0123456565',NULL,'Văn An',NULL,NULL,'url','user',NULL,'active',0,NULL,NULL,NULL,NULL,'2026-02-27 03:42:00','2026-02-27 03:42:00',NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voucher_locations`
--

DROP TABLE IF EXISTS `voucher_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voucher_locations` (
  `voucher_id` int NOT NULL,
  `location_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`voucher_id`,`location_id`),
  KEY `idx_vl_location` (`location_id`),
  CONSTRAINT `voucher_locations_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `voucher_locations_fk_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`voucher_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voucher_locations`
--

LOCK TABLES `voucher_locations` WRITE;
/*!40000 ALTER TABLE `voucher_locations` DISABLE KEYS */;
/*!40000 ALTER TABLE `voucher_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voucher_reviews`
--

DROP TABLE IF EXISTS `voucher_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voucher_reviews` (
  `voucher_id` int NOT NULL,
  `approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejection_reason` text,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`voucher_id`),
  KEY `idx_vr_status` (`approval_status`),
  KEY `idx_vr_reviewed_by` (`reviewed_by`),
  CONSTRAINT `voucher_reviews_fk_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `voucher_reviews_fk_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`voucher_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voucher_reviews`
--

LOCK TABLES `voucher_reviews` WRITE;
/*!40000 ALTER TABLE `voucher_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `voucher_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voucher_usage_history`
--

DROP TABLE IF EXISTS `voucher_usage_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voucher_usage_history` (
  `usage_id` bigint NOT NULL AUTO_INCREMENT,
  `voucher_id` int NOT NULL,
  `voucher_code` varchar(50) NOT NULL,
  `user_id` int NOT NULL,
  `user_full_name` varchar(255) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `used_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `booking_id` int DEFAULT NULL,
  `location_id` int DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT NULL,
  `final_amount` decimal(10,2) DEFAULT NULL,
  `source` enum('booking','pos','other') NOT NULL DEFAULT 'booking',
  PRIMARY KEY (`usage_id`),
  KEY `idx_vuh_voucher_used_at` (`voucher_id`,`used_at`),
  KEY `idx_vuh_user_used_at` (`user_id`,`used_at`),
  KEY `idx_vuh_booking_id` (`booking_id`),
  KEY `idx_vuh_location_id` (`location_id`),
  KEY `idx_vuh_voucher_code` (`voucher_code`),
  CONSTRAINT `vuh_fk_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL,
  CONSTRAINT `vuh_fk_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE SET NULL,
  CONSTRAINT `vuh_fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `vuh_fk_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`voucher_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voucher_usage_history`
--

LOCK TABLES `voucher_usage_history` WRITE;
/*!40000 ALTER TABLE `voucher_usage_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `voucher_usage_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vouchers`
--

DROP TABLE IF EXISTS `vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vouchers` (
  `voucher_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int DEFAULT NULL,
  `location_id` int DEFAULT NULL,
  `code` varchar(50) NOT NULL,
  `campaign_name` varchar(255) DEFAULT NULL,
  `campaign_description` text,
  `discount_type` enum('percent','amount') NOT NULL,
  `discount_value` decimal(10,2) NOT NULL,
  `apply_to_service_type` enum('all','room','food','ticket','other') DEFAULT 'all',
  `apply_to_location_type` enum('all','hotel','restaurant','tourist','cafe','resort','other') DEFAULT 'all',
  `min_order_value` decimal(10,2) DEFAULT '0.00',
  `max_discount_amount` decimal(10,2) DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `usage_limit` int DEFAULT '100',
  `max_uses_per_user` int DEFAULT '1',
  `used_count` int DEFAULT '0',
  `status` enum('active','inactive','expired') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `owner_deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`voucher_id`),
  UNIQUE KEY `unique_code_owner` (`code`,`owner_id`),
  KEY `vouchers_owner_fk` (`owner_id`),
  KEY `vouchers_location_fk` (`location_id`),
  CONSTRAINT `vouchers_location_fk` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE CASCADE,
  CONSTRAINT `vouchers_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vouchers`
--

LOCK TABLES `vouchers` WRITE;
/*!40000 ALTER TABLE `vouchers` DISABLE KEYS */;
/*!40000 ALTER TABLE `vouchers` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-02 17:13:50
