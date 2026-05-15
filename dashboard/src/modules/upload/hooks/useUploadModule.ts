import { useCallback, useEffect, useState } from "react";
import { uploadService } from "../services/upload.service";
import type {
  PendingMediaItem,
  UploadVideoInput,
} from "../../../shared/types/upload";

type UploadState = {
  pendingPath: string;
  items: PendingMediaItem[];
  isLoadingList: boolean;
  isUploading: boolean;
  error: string | null;
};

const INITIAL_PATH = "/home/socialbot/media/reels/pending";

export function useUploadModule() {
  const [state, setState] = useState<UploadState>({
    pendingPath: INITIAL_PATH,
    items: [],
    isLoadingList: true,
    isUploading: false,
    error: null,
  });

  const loadPending = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoadingList: true, error: null }));

    try {
      const response = await uploadService.listPending();
      setState((prev) => ({
        ...prev,
        pendingPath: response.pendingPath,
        items: response.items,
        isLoadingList: false,
        error: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isLoadingList: false,
        error: "Falha ao carregar pasta pending do servidor.",
      }));
    }
  }, []);

  const uploadVideo = useCallback(
    async (input: UploadVideoInput) => {
      setState((prev) => ({ ...prev, isUploading: true, error: null }));

      try {
        await uploadService.upload(input);
        await loadPending();
        setState((prev) => ({ ...prev, isUploading: false }));
        return true;
      } catch {
        setState((prev) => ({
          ...prev,
          isUploading: false,
          error: "Falha ao enviar video para o backend.",
        }));
        return false;
      }
    },
    [loadPending],
  );

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  return {
    ...state,
    loadPending,
    uploadVideo,
  };
}
