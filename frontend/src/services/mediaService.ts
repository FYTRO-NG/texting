import { PostImage } from "./postService";
import { getAuthToken } from "./apiClient";

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://private-voices-api.onrender.com/api";

export const uploadMediaToFastAPI = async (
  uri: string,
  filename = "upload.jpg"
): Promise<string | null> => {
  try {
    const formData = new FormData();
    const token = await getAuthToken();

    if (uri.startsWith("data:")) {
      const arr = uri.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      formData.append("file", blob, filename);
    } else {
      formData.append("file", {
        uri,
        name: filename,
        type: "image/jpeg",
      } as any);
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/media/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.url) return data.url;
    }
    return uri;
  } catch (err) {
    console.warn("FastAPI media upload error:", err);
    return uri;
  }
};

export const uploadPostImages = async (
  uris: string[],
  userId: string,
  onProgress?: (progress: number) => void
): Promise<PostImage[]> => {
  const results: PostImage[] = [];
  const total = uris.length;

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];

    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      results.push({ url: uri });
      if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
      continue;
    }

    const filename = `${Date.now()}_${i}.jpg`;
    const url = await uploadMediaToFastAPI(uri, filename);

    results.push({ url: url || uri });
    if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
  }

  if (onProgress) onProgress(100);
  return results;
};
