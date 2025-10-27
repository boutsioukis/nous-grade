// Types for screen capture functionality

export interface CaptureRequest {
  type: 'student' | 'professor';
  requestId: string;
}

export interface CaptureResult {
  type: 'student' | 'professor';
  requestId: string;
  imageData: string; // Base64 encoded image
  success: boolean;
  error?: string;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenCaptureOptions {
  audio: boolean;
  video: boolean;
  videoConstraints?: {
    mandatory?: {
      chromeMediaSource: string;
      chromeMediaSourceId: string;
    };
  };
}

export interface OffscreenMessage {
  type: 'START_CAPTURE' | 'PROCESS_MEDIA_STREAM' | 'CAPTURE_COMPLETE' | 'CAPTURE_ERROR';
  streamId?: string;
  requestId?: string;
  captureType?: 'student' | 'professor';
  imageData?: string;
  error?: string;
  cropArea?: CropArea;
}

export interface MediaStreamConstraints {
  audio: boolean;
  video: {
    mandatory: {
      chromeMediaSource: 'desktop';
      chromeMediaSourceId: string;
    };
  };
}
