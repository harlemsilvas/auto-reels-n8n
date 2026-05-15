import { buildApiUrl } from "../../../shared/config/api";
import { getJson, postForm } from "../../../shared/lib/http";
import type {
  PendingMediaResponse,
  UploadVideoInput,
  UploadVideoResponse,
} from "../../../shared/types/upload";

export const uploadService = {
  async listPending(): Promise<PendingMediaResponse> {
    return getJson<PendingMediaResponse>(buildApiUrl("/api/media/pending"));
  },

  async upload(input: UploadVideoInput): Promise<UploadVideoResponse> {
    const formData = new FormData();
    formData.append("video", input.videoFile);
    formData.append("captionText", input.captionText);

    if (input.accountName) {
      formData.append("accountName", input.accountName);
    }

    if (input.scheduleAt) {
      formData.append("scheduleAt", input.scheduleAt);
    }

    return postForm<UploadVideoResponse>(
      buildApiUrl("/api/media/upload"),
      formData,
    );
  },
};
