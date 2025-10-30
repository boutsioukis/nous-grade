import React, { useState, useEffect } from 'react';
import './GradingOverlay.css';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CameraIcon,
  PlusIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  XCircleIcon,
  XMarkIcon,
  LoadingSpinnerIcon
} from './Icons';

interface GradingOverlayProps {
  onClose: () => void;
}

interface CaptureState {
  student: boolean;
  professor: boolean;
}

interface PanelState {
  studentCollapsed: boolean;
  professorCollapsed: boolean;
}

interface ImageData {
  id: string;
  imageData: string;
  timestamp: number;
  markdown?: string;
}

const GradingOverlay: React.FC<GradingOverlayProps> = ({ onClose }) => {
  
  const [captureState, setCaptureState] = useState<CaptureState>({
    student: false,
    professor: false
  });
  
  const [panelState, setPanelState] = useState<PanelState>({
    studentCollapsed: false,
    professorCollapsed: false
  });
  
  const [studentImages, setStudentImages] = useState<ImageData[]>([]);
  const [professorImages, setProfessorImages] = useState<ImageData[]>([]);
  const [studentMarkdown, setStudentMarkdown] = useState<string | null>(null);
  const [professorMarkdown, setProfessorMarkdown] = useState<string | null>(null);
  const [gradingResult, setGradingResult] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [markdownConverted, setMarkdownConverted] = useState(false);
  const [error, setError] = useState<{type: string, message: string} | null>(null);

  // Listen for capture completion events
  useEffect(() => {
    
    const handleCaptureComplete = (event: CustomEvent) => {
      console.log('🟢 Capture completed:', event.detail);
      const { captureType, imageData, success } = event.detail;
      
      if (success && imageData) {
        setCaptureState(prev => ({ ...prev, [captureType]: true }));
        
        const newImage: ImageData = {
          id: `${captureType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          imageData,
          timestamp: Date.now()
        };
        
        if (captureType === 'student') {
          setStudentImages(prev => [...prev, newImage]);
          console.log('🟢 Student image added, total images:', studentImages.length + 1);
        } else if (captureType === 'professor') {
          setProfessorImages(prev => [...prev, newImage]);
          console.log('🟢 Professor image added, total images:', professorImages.length + 1);
        }
      }
    };

    const handleCaptureError = (event: CustomEvent) => {
      console.error('🔴 Capture error:', event.detail);
      const { captureType, error: errorMessage } = event.detail;
      setCaptureState(prev => ({ ...prev, [captureType]: false }));
      setError({
        type: 'capture',
        message: errorMessage || `Failed to capture ${captureType} answer. The image may be too blurry or the page content is not accessible.`
      });
    };

    const handleMarkdownComplete = (event: CustomEvent) => {
      console.log('🟢 Markdown conversion completed:', event.detail);
      const { captureType, markdown, confidence, success, error: errorMessage } = event.detail;
      
      if (success && markdown) {
        if (captureType === 'student') {
          setStudentMarkdown(markdown);
          console.log('🟢 Student markdown set, length:', markdown.length);
        } else if (captureType === 'professor') {
          setProfessorMarkdown(markdown);
          console.log('🟢 Professor markdown set, length:', markdown.length);
        }
        setError(null); // Clear any previous errors
      } else {
        setError({
          type: 'markdown',
          message: errorMessage || 'Failed to convert images to text. The images may be unclear or contain unsupported content.'
        });
      }
      
      setIsConverting(false);
    };

    const handleProcessingUpdate = (event: CustomEvent) => {
      console.log('🟢 Processing state update received:', event.detail);
      // You can add additional state updates here if needed
    };

    const handleGradingComplete = (event: CustomEvent) => {
      console.log('🟢 Grading completed:', event.detail);
      const { result, success, error: errorMessage } = event.detail;
      
      if (success && result) {
        setGradingResult(result);
        setIsProcessing(false);
        setError(null); // Clear any previous errors
        console.log('🟢 Grading result set:', result);
      } else {
        console.error('🔴 Grading failed:', event.detail);
        setIsProcessing(false);
        setError({
          type: 'grading',
          message: errorMessage || 'AI grading failed. This may be due to server issues or unclear content. Please try again.'
        });
      }
    };

    // Add event listeners
    document.addEventListener('nous-grade-capture-result', handleCaptureComplete as EventListener);
    document.addEventListener('nous-grade-capture-error', handleCaptureError as EventListener);
    document.addEventListener('nous-grade-markdown-complete', handleMarkdownComplete as EventListener);
    document.addEventListener('nous-grade-processing-update', handleProcessingUpdate as EventListener);
    document.addEventListener('nous-grade-grading-complete', handleGradingComplete as EventListener);

    // Cleanup
    return () => {
      document.removeEventListener('nous-grade-capture-result', handleCaptureComplete as EventListener);
      document.removeEventListener('nous-grade-capture-error', handleCaptureError as EventListener);
      document.removeEventListener('nous-grade-markdown-complete', handleMarkdownComplete as EventListener);
      document.removeEventListener('nous-grade-processing-update', handleProcessingUpdate as EventListener);
      document.removeEventListener('nous-grade-grading-complete', handleGradingComplete as EventListener);
    };
  }, []);

  // Check if both markdowns are available and update markdownConverted state
  useEffect(() => {
    if (studentMarkdown && professorMarkdown && !markdownConverted) {
      setMarkdownConverted(true);
      console.log('🟢 Both markdowns available, ready for grading');
    }
  }, [studentMarkdown, professorMarkdown, markdownConverted]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleCaptureClick = async (type: 'student' | 'professor') => {
    console.log(`🟢 Starting capture for ${type}`);
    
    // Clear any previous errors
    setError(null);
    
    // Reset markdown states when new capture starts (since we'll need to re-convert all images)
    if (type === 'student') {
      setStudentMarkdown(null);
    } else {
      setProfessorMarkdown(null);
    }
    setMarkdownConverted(false);
    
    // Dispatch custom event to trigger capture
    const captureEvent = new CustomEvent('nous-grade-capture-request', {
      detail: { captureType: type }
    });
    document.dispatchEvent(captureEvent);
    console.log(`🟢 ${type} capture request sent successfully`);
  };

  const handleRemoveImage = (type: 'student' | 'professor', imageId: string) => {
    console.log(`🟢 Removing ${type} image:`, imageId);
    
    if (type === 'student') {
      setStudentImages(prev => prev.filter(img => img.id !== imageId));
      setStudentMarkdown(null); // Reset markdown since images changed
    } else {
      setProfessorImages(prev => prev.filter(img => img.id !== imageId));
      setProfessorMarkdown(null); // Reset markdown since images changed
    }
    setMarkdownConverted(false);
  };

  const handleClearAllImages = (type: 'student' | 'professor') => {
    console.log(`🟢 Clearing all ${type} images`);
    
    if (type === 'student') {
      setStudentImages([]);
      setStudentMarkdown(null);
      setCaptureState(prev => ({ ...prev, student: false }));
    } else {
      setProfessorImages([]);
      setProfessorMarkdown(null);
      setCaptureState(prev => ({ ...prev, professor: false }));
    }
    setMarkdownConverted(false);
  };

  const handleTranslateToMarkdown = async () => {
    if (studentImages.length === 0 || professorImages.length === 0) {
      console.error('Both student and professor images must be captured before markdown conversion');
      return;
    }

    // Clear any previous errors
    setError(null);
    setIsConverting(true);
    console.log('🟢 Starting markdown conversion for multiple images');
    
    try {
      // Dispatch event to trigger markdown conversion with all images
      const convertEvent = new CustomEvent('nous-grade-convert-to-markdown', {
        detail: { 
          studentImages: studentImages,
          professorImages: professorImages
        }
      });
      document.dispatchEvent(convertEvent);
      console.log('🟢 Markdown conversion request sent with multiple images');
    } catch (error) {
      console.error('🔴 Error starting markdown conversion:', error);
      setIsConverting(false);
      setError({
        type: 'markdown',
        message: 'Failed to start text conversion. Please try again.'
      });
    }
  };

  const handleStartGrading = async () => {
    console.log('🟢 Starting grading process');
    
    // Clear any previous errors
    setError(null);
    setIsProcessing(true);
    
    try {
      // Dispatch event to trigger grading
      const gradingEvent = new CustomEvent('nous-grade-grading-request', {
        detail: {}
      });
      document.dispatchEvent(gradingEvent);
      console.log('🟢 Grading request sent');
    } catch (error) {
      console.error('🔴 Error starting grading:', error);
      setIsProcessing(false);
      setError({
        type: 'grading',
        message: 'Failed to start grading process. Please try again.'
      });
    }
  };

  const handleRetry = () => {
    if (!error) return;
    
    switch (error.type) {
      case 'capture':
        // Retry last capture - we'll need to determine which one failed
        setError(null);
        break;
      case 'markdown':
        handleTranslateToMarkdown();
        break;
      case 'grading':
        handleStartGrading();
        break;
      default:
        setError(null);
    }
  };

  const canTranslateToMarkdown = studentImages.length > 0 && professorImages.length > 0 && !studentMarkdown && !professorMarkdown;
  const canStartGrading = studentMarkdown && professorMarkdown;

  const togglePanel = (panel: 'student' | 'professor') => {
    setPanelState(prev => ({
      ...prev,
      [`${panel}Collapsed`]: !prev[`${panel}Collapsed` as keyof PanelState]
    }));
  };


  return (
    <div className="grading-overlay">
        <div className="grading-container" role="dialog" aria-labelledby="grading-title" aria-modal="true">
        {/* Header */}
        <div className="grading-header">
          <h2 id="grading-title">Nous-Grade Tool</h2>
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Close grading tool"
            autoFocus
          >
            ×
          </button>
        </div>

        {/* Capture Section */}
        <div className="capture-section">
          <div className="capture-row">
            {/* Student Answer Capture */}
            <div className={`capture-item ${panelState.studentCollapsed ? 'collapsed' : ''}`} role="region" aria-labelledby="student-panel-title">
              <div className="capture-header">
                <div className="panel-title-section">
                  <h3 id="student-panel-title">Student Answer ({studentImages.length} image{studentImages.length !== 1 ? 's' : ''})</h3>
                  {studentImages.length > 0 && !panelState.studentCollapsed && (
                    <button 
                      className="clear-all-button"
                      onClick={() => handleClearAllImages('student')}
                      title="Clear all images"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <button 
                  className="panel-toggle-button"
                  onClick={() => togglePanel('student')}
                  title={panelState.studentCollapsed ? 'Expand panel' : 'Collapse panel'}
                  aria-label={panelState.studentCollapsed ? 'Expand student panel' : 'Collapse student panel'}
                >
                  <ChevronLeftIcon 
                    className={`chevron-icon ${panelState.studentCollapsed ? 'collapsed' : ''}`}
                    width={16}
                    height={16}
                  />
                </button>
              </div>
              
              {!panelState.studentCollapsed && (
                <div className="capture-area">
                  {studentImages.length === 0 ? (
                    <div className="empty-state">
                      <CameraIcon 
                        className="empty-state-icon" 
                        width={48} 
                        height={48}
                      />
                      <h4>No Student Answer Captured</h4>
                      <p>Click the button below to capture the student's answer from this tab</p>
                      <button 
                        className="capture-button primary"
                        onClick={() => handleCaptureClick('student')}
                      >
                        <PlusIcon className="button-icon" width={20} height={20} />
                        Capture Student Answer
                      </button>
                    </div>
                  ) : (
                    <div className="images-grid">
                      {studentImages.map((image, index) => (
                      <div key={image.id} className="image-item">
                        <div className="image-header">
                          <span className="image-number">#{index + 1}</span>
                          <button 
                            className="remove-image-button"
                            onClick={() => handleRemoveImage('student', image.id)}
                            title="Remove this image"
                          >
                            ×
                          </button>
                        </div>
                        <img src={image.imageData} alt={`Student Answer ${index + 1}`} />
                      </div>
                    ))}
                    
                    <div className="add-image-placeholder">
                      <button 
                        className="capture-button"
                        onClick={() => handleCaptureClick('student')}
                      >
                        <PlusIcon className="button-icon" width={20} height={20} />
                        Capture Student Answer
                      </button>
                    </div>
                    )}
                  
                  {studentMarkdown && (
                    <div className="markdown-content">
                      <h4>Converted Text (All Images):</h4>
                      <div className="markdown-text">{studentMarkdown}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Professor Answer Capture */}
            <div className={`capture-item ${panelState.professorCollapsed ? 'collapsed' : ''}`} role="region" aria-labelledby="professor-panel-title">
              <div className="capture-header">
                <div className="panel-title-section">
                  <h3 id="professor-panel-title">Professor Answer ({professorImages.length} image{professorImages.length !== 1 ? 's' : ''})</h3>
                  {professorImages.length > 0 && !panelState.professorCollapsed && (
                    <button 
                      className="clear-all-button"
                      onClick={() => handleClearAllImages('professor')}
                      title="Clear all images"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <button 
                  className="panel-toggle-button"
                  onClick={() => togglePanel('professor')}
                  title={panelState.professorCollapsed ? 'Expand panel' : 'Collapse panel'}
                  aria-label={panelState.professorCollapsed ? 'Expand professor panel' : 'Collapse professor panel'}
                >
                  <ChevronRightIcon 
                    className={`chevron-icon ${panelState.professorCollapsed ? 'collapsed' : ''}`}
                    width={16}
                    height={16}
                  />
                </button>
              </div>
              
              {!panelState.professorCollapsed && (
                <div className="capture-area">
                  {professorImages.length === 0 ? (
                    <div className="empty-state">
                      <CameraIcon 
                        className="empty-state-icon" 
                        width={48} 
                        height={48}
                      />
                      <h4>No Professor Answer Captured</h4>
                      <p>Click the button below to capture the professor's answer from this tab</p>
                      <button 
                        className="capture-button primary"
                        onClick={() => handleCaptureClick('professor')}
                      >
                        <PlusIcon className="button-icon" width={20} height={20} />
                        Capture Professor Answer
                      </button>
                    </div>
                  ) : (
                    <div className="images-grid">
                      {professorImages.map((image, index) => (
                      <div key={image.id} className="image-item">
                        <div className="image-header">
                          <span className="image-number">#{index + 1}</span>
                          <button 
                            className="remove-image-button"
                            onClick={() => handleRemoveImage('professor', image.id)}
                            title="Remove this image"
                          >
                            ×
                          </button>
                        </div>
                        <img src={image.imageData} alt={`Professor Answer ${index + 1}`} />
                      </div>
                    ))}
                    
                    <div className="add-image-placeholder">
                      <button 
                        className="capture-button"
                        onClick={() => handleCaptureClick('professor')}
                      >
                        <PlusIcon className="button-icon" width={20} height={20} />
                        Capture Professor Answer
                      </button>
                    </div>
                    )}
                  
                  {professorMarkdown && (
                    <div className="markdown-content">
                      <h4>Converted Text (All Images):</h4>
                      <div className="markdown-text">{professorMarkdown}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Central Control Bar */}
        <div className="control-bar" role="toolbar" aria-label="Grading actions">
          <div className="control-bar-section">
            <button 
              className={`control-button translate-button ${canTranslateToMarkdown ? 'enabled' : 'disabled'}`}
              onClick={handleTranslateToMarkdown}
              disabled={!canTranslateToMarkdown || isConverting}
              title="Convert captured images to text"
            >
              {isConverting ? (
                <LoadingSpinnerIcon className="button-icon" width={16} height={16} />
              ) : (
                <BookOpenIcon className="button-icon" width={16} height={16} />
              )}
              {isConverting ? 'Converting...' : 'Translate to Markdown'}
            </button>
            
            <button 
              className={`control-button grade-button ${canStartGrading ? 'enabled' : 'disabled'}`}
              onClick={handleStartGrading}
              disabled={!canStartGrading || isProcessing}
              title="Start AI grading process"
            >
              {isProcessing ? (
                <LoadingSpinnerIcon className="button-icon" width={16} height={16} />
              ) : (
                <CheckCircleIcon className="button-icon" width={16} height={16} />
              )}
              {isProcessing ? 'Grading...' : 'Start Grading'}
            </button>
          </div>
          
          <div className="control-bar-section">
            {gradingResult && (
              <>
                <button 
                  className="control-button export-button"
                  onClick={() => {/* TODO: Implement export */}}
                  title="Export grading results"
                >
                  <ArrowUpTrayIcon className="button-icon" width={16} height={16} />
                  Export Results
                </button>
                
                <button 
                  className="control-button reset-button"
                  onClick={() => {/* TODO: Implement reset */}}
                  title="Reset for next student"
                >
                  <ArrowPathIcon className="button-icon" width={16} height={16} />
                  Next Student
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="error-state" role="alert" aria-live="polite">
            <div className="error-content">
              <XCircleIcon className="error-icon" width={20} height={20} />
              <div className="error-text">
                <h4>Something went wrong</h4>
                <p>{error.message}</p>
              </div>
            </div>
            <div className="error-actions">
              <button 
                className="retry-button"
                onClick={handleRetry}
                title="Try the action again"
              >
                <ArrowPathIcon className="button-icon" width={16} height={16} />
                Retry
              </button>
              <button 
                className="dismiss-button"
                onClick={() => setError(null)}
                title="Dismiss this error"
              >
                <XMarkIcon className="button-icon" width={16} height={16} />
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Grading Results */}
        {gradingResult && (
          <div className="grading-results">
            <h3>Grading Results</h3>
            <div className="grading-score">
              <span className="points-earned">{gradingResult.points}</span>
              <span className="points-separator"> / </span>
              <span className="points-total">{gradingResult.maxPoints}</span>
              <div className="points-label">Points</div>
            </div>
            <div className="grading-feedback">
              <h4>Feedback:</h4>
              <p>{gradingResult.feedback}</p>
            </div>
            <div className="grading-reasoning">
              <h4>Reasoning:</h4>
              <p>{gradingResult.reasoning}</p>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="status-section">
          <div className="status-item">
            <span className={`status-indicator ${studentImages.length > 0 ? 'active' : 'inactive'}`}></span>
            Student Answer: {studentImages.length} image{studentImages.length !== 1 ? 's' : ''}
          </div>
          <div className="status-item">
            <span className={`status-indicator ${professorImages.length > 0 ? 'active' : 'inactive'}`}></span>
            Professor Answer: {professorImages.length} image{professorImages.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradingOverlay;
