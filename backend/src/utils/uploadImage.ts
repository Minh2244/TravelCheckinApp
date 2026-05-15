// backend/src/utils/uploadImage.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type SaveImageArgs = {
  file: Express.Multer.File;
  folder:
    | "avatars"
    | "backgrounds"
    | "checkins"
    | "reviews"
    | "locations"
    | "services";
  fileNamePrefix: string;
};

export const saveUploadedImageToUploads = async ({
  file,
  folder,
  fileNamePrefix,
}: SaveImageArgs): Promise<{ urlPath: string; fileName: string }> => {
  if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    throw new Error("Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG/PNG/WebP)");
  }

  const ext =
    file.mimetype === "image/png"
      ? ".png"
      : file.mimetype === "image/webp"
        ? ".webp"
        : ".jpg";

  const fileName = `${fileNamePrefix}-${Date.now()}-${crypto
    .randomBytes(6)
    .toString("hex")}${ext}`;

  const uploadRoot = path.resolve(__dirname, "..", "..", "uploads");
  const dirPath = path.join(uploadRoot, folder);
  await fs.mkdir(dirPath, { recursive: true });

  const absPath = path.join(dirPath, fileName);
  await fs.writeFile(absPath, file.buffer);

  const urlPath = `/uploads/${folder}/${fileName}`;
  return { urlPath, fileName };
};
