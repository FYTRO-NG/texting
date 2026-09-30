import { storage } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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

    // Support web data URIs and native file URIs
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
    return null;
  } catch (err) {
    console.warn("FastAPI media upload error, falling back:", err);
    return null;
  }
};

export const uploadMediaToFirebase = async (
  uri: string,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  // Try uploading to our FastAPI backend first
  try {
    const filename = path.split("/").pop() || "upload.jpg";
    const fastApiUrl = await uploadMediaToFastAPI(uri, filename);
    if (fastApiUrl) {
      if (onProgress) onProgress(100);
      return fastApiUrl;
    }
  } catch (e) {
    console.warn("FastAPI upload fallback to Firebase Storage:", e);
  }

  let blob: Blob;
  
  if (uri.startsWith("data:")) {
    // Base64 Data URL (from web EXIF-stripping canvas)
    const arr = uri.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    blob = new Blob([u8arr], { type: mime });
  } else {
    const response = await fetch(uri);
    blob = await response.blob();
  }

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, blob);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
        if (onProgress) onProgress(progress);
      },
      (err) => {
        console.warn("Storage upload failed, fallback to data URL:", err);
        // Fallback to data URL or object URL if Firebase Storage bucket security rules block upload
        resolve(uri);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (_) {
          resolve(uri);
        }
      }
    );
  });
};

/**
 * Upload multiple post images to Firebase Storage.
 * Returns structured PostImage objects with url + storagePath.
 * Calls onProgress with overall progress 0-100.
 */
export const uploadPostImages = async (
  uris: string[],
  userId: string,
  onProgress?: (progress: number) => void
): Promise<PostImage[]> => {
  const results: PostImage[] = [];
  const total = uris.length;

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];

    // Skip already-uploaded URLs (https://...)
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      results.push({ url: uri, storagePath: "" });
      if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
      continue;
    }

    const filename = `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}.jpg`;
    const storagePath = `uploads/${userId}/posts/${filename}`;

    const url = await uploadMediaToFirebase(uri, storagePath, (pct) => {
      // Weight each image equally for overall progress
      const overall = Math.round(((i + pct / 100) / total) * 100);
      if (onProgress) onProgress(overall);
    });

    results.push({ url, storagePath });
  }

  if (onProgress) onProgress(100);
  return results;
};
