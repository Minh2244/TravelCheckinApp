import { Directory, File, Paths } from "expo-file-system";

const IMAGE_CACHE_DIR_NAME = "travelcheckin-image-cache-v1";
const pending = new Map<string, Promise<string | null>>();

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function ensureCacheDirectory() {
  const directory = new Directory(Paths.cache, IMAGE_CACHE_DIR_NAME);
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
  return directory;
}

function removeFile(file: File) {
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Cache cleanup must not block image rendering.
  }
}

async function createCachedImage(imageUrl: string) {
  const directory = ensureCacheDirectory();
  const outputFile = new File(directory, `${hashString(imageUrl)}.jpg`);

  if (outputFile.exists && outputFile.size > 0) {
    return outputFile.uri;
  }

  removeFile(outputFile);

  try {
    const downloaded = await File.downloadFileAsync(imageUrl, outputFile, {
      idempotent: true,
      headers: {
        Accept: "image/*",
        "ngrok-skip-browser-warning": "true",
      },
    });

    return downloaded.exists && downloaded.size > 0 ? downloaded.uri : null;
  } catch {
    removeFile(outputFile);
    return null;
  }
}

export function getCachedImageUri(imageUrl?: string | null) {
  if (!imageUrl) {
    return Promise.resolve(null);
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    return Promise.resolve(imageUrl);
  }

  const existing = pending.get(imageUrl);
  if (existing) {
    return existing;
  }

  const request = createCachedImage(imageUrl).finally(() => {
    pending.delete(imageUrl);
  });
  pending.set(imageUrl, request);
  return request;
}
