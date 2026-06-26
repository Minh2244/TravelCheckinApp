import { Directory, File, Paths } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { PixelRatio } from "react-native";

const MARKER_CACHE_DIR_NAME = "travelcheckin-native-marker-cache-v4";
const MARKER_SOURCE_SIZE = PixelRatio.getPixelSizeForLayoutSize(38);

const pending = new Map<string, Promise<string | null>>();

function hashString(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function ensureCacheDirectory() {
  const directory = new Directory(Paths.cache, MARKER_CACHE_DIR_NAME);

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
    // Cache cleanup should never block marker rendering.
  }
}

async function createCachedMarkerImage(
  locationId: number | string,
  imageUrl: string,
) {
  const directory = ensureCacheDirectory();
  const cacheKey = `${locationId}-${MARKER_SOURCE_SIZE}-${hashString(imageUrl)}`;
  const outputFile = new File(directory, `${cacheKey}.png`);

  if (outputFile.exists && outputFile.size > 0) {
    return outputFile.uri;
  }

  const sourceFile = new File(directory, `${cacheKey}.source`);
  removeFile(sourceFile);

  try {
    const downloaded = await File.downloadFileAsync(imageUrl, sourceFile, {
      idempotent: true,
      headers: {
        Accept: "image/*",
        "ngrok-skip-browser-warning": "true",
      },
    });

    const resized = await manipulateAsync(
      downloaded.uri,
      [
        {
          resize: {
            width: MARKER_SOURCE_SIZE,
            height: MARKER_SOURCE_SIZE,
          },
        },
      ],
      {
        compress: 1,
        format: SaveFormat.PNG,
      },
    );

    const resizedFile = new File(resized.uri);
    removeFile(outputFile);
    resizedFile.move(outputFile);
    removeFile(sourceFile);

    return outputFile.uri;
  } catch {
    removeFile(sourceFile);
    removeFile(outputFile);
    return null;
  }
}

export function getCachedLocationMarkerImage({
  imageUrl,
  locationId,
}: {
  imageUrl?: string | null;
  locationId: number | string;
}) {
  if (!imageUrl) {
    return Promise.resolve(null);
  }

  const key = `${locationId}:${imageUrl}`;
  const existing = pending.get(key);

  if (existing) {
    return existing;
  }

  const request = createCachedMarkerImage(locationId, imageUrl).finally(() => {
    pending.delete(key);
  });

  pending.set(key, request);
  return request;
}
