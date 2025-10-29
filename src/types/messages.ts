// Message types for communication between components
export interface MessageTypes {
  'START_CAPTURE': { 
    type: 'student' | 'professor';
    captureType: 'student' | 'professor';
  };
  'CAPTURE_COMPLETE': { 
    type: 'student' | 'professor';
    imageData: string;
  };
  'START_GRADING': { 
    studentImageData: string;
    professorImageData: string;
  };
  'GRADING_COMPLETE': { 
    result: GradingResult;
  };
  'INJECT_GRADING_UI': {};
  'REMOVE_GRADING_UI': {};
  'SHOW_SCREEN_SELECTOR': {
    screenImageData: string;
    captureType: 'student' | 'professor';
  };
  'CAPTURE_COMPLETE_FROM_CONTENT_SCRIPT': {
    imageData: string;
    captureType: 'student' | 'professor';
    selectionArea: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  'CAPTURE_CANCELLED': {
    captureType: 'student' | 'professor';
  };
}

export interface GradingResult {
  gradedAnswer: string;
  points: number;
  maxPoints: number;
  reasoning: string;
  feedback: string;
}

export interface CaptureState {
  student: boolean;
  professor: boolean;
}

export interface GradingState {
  isProcessing: boolean;
  result: GradingResult | null;
  error: string | null;
}
