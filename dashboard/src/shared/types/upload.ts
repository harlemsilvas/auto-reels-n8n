export type PendingMediaItem = {
  id: string;
  baseName: string;
  videoFile: string;
  captionFile: string | null;
  createdAt: string;
};

export type PendingMediaResponse = {
  pendingPath: string;
  items: PendingMediaItem[];
};

export type UploadVideoInput = {
  videoFile: File;
  captionText: string;
  accountName?: string;
  scheduleAt?: string;
};

export type UploadVideoResponse = {
  message: string;
  itemId: string;
};

export type PublishType =
  | "reel"
  | "feed_image"
  | "feed_carousel"
  | "story_image"
  | "story_video";

export type UploadPostInput = {
  files: File[];
  publishType: PublishType;
  captionText: string;
  workspaceId?: string;
  scheduleAt?: string;
};

export type UploadPostResponse = {
  message: string;
  post: {
    id: string;
    status: string;
    publishType: PublishType;
    mediaType: "image" | "video" | "carousel";
    scheduledAt: string | null;
    mediaItems: number;
  };
};

export type PublishCapability = {
  uploadEnabled: boolean;
  publishEnabled: boolean;
  publisher: "n8n" | "meta";
};

export type UploadCapabilitiesResponse = {
  uploadPostEnabled: boolean;
  multiPublishEnabled: boolean;
  publishTypes: Record<PublishType, PublishCapability>;
};
