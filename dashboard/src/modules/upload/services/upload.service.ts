import { buildApiUrl } from "../../../shared/config/api";
import { getJson, postForm } from "../../../shared/lib/http";
import type {
  PendingMediaResponse,
  UploadCapabilitiesResponse,
  UploadPostInput,
  UploadPostResponse,
  UploadVideoInput,
  UploadVideoResponse,
} from "../../../shared/types/upload";

export const uploadService = {
  async getCapabilities(): Promise<UploadCapabilitiesResponse> {
    return getJson<UploadCapabilitiesResponse>(
      buildApiUrl("/api/media/capabilities"),
    );
  },

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

  async uploadPost(input: UploadPostInput): Promise<UploadPostResponse> {
    const formData = new FormData();

    input.files.forEach((file) => {
      formData.append("files", file);
    });

    formData.append("publishType", input.publishType);
    formData.append("captionText", input.captionText);

    if (input.workspaceId) {
      formData.append("workspaceId", input.workspaceId);
    }

    if (input.scheduleAt) {
      formData.append("scheduleAt", input.scheduleAt);
    }

    return postForm<UploadPostResponse>(
      buildApiUrl("/api/media/upload-post"),
      formData,
    );
  },
};
