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
