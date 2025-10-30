import React, { useState, useEffect } from 'react';
import './GradingOverlay.css';

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
      <div className="grading-container">
        {/* Header */}
        <div className="grading-header">
          <h2>Nous-Grade Tool</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Capture Section */}
        <div className="capture-section">
          <div className="capture-row">
            {/* Student Answer Capture */}
            <div className={`capture-item ${panelState.studentCollapsed ? 'collapsed' : ''}`}>
              <div className="capture-header">
                <div className="panel-title-section">
                  <h3>Student Answer ({studentImages.length} image{studentImages.length !== 1 ? 's' : ''})</h3>
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
                  <svg 
                    className={`chevron-icon ${panelState.studentCollapsed ? 'collapsed' : ''}`}
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <polyline points="15,18 9,12 15,6"></polyline>
                  </svg>
                </button>
              </div>
              
              {!panelState.studentCollapsed && (
                <div className="capture-area">
                  {studentImages.length === 0 ? (
                    <div className="empty-state">
                      <svg className="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <h4>No Student Answer Captured</h4>
                      <p>Click the button below to capture the student's answer from this tab</p>
                      <button 
                        className="capture-button primary"
                        onClick={() => handleCaptureClick('student')}
                      >
                        <svg className="button-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14m-7-7h14"/>
                        </svg>
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
                        <svg className="button-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14m-7-7h14"/>
                        </svg>
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
            <div className={`capture-item ${panelState.professorCollapsed ? 'collapsed' : ''}`}>
              <div className="capture-header">
                <div className="panel-title-section">
                  <h3>Professor Answer ({professorImages.length} image{professorImages.length !== 1 ? 's' : ''})</h3>
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
                  <svg 
                    className={`chevron-icon ${panelState.professorCollapsed ? 'collapsed' : ''}`}
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <polyline points="9,18 15,12 9,6"></polyline>
                  </svg>
                </button>
              </div>
              
              {!panelState.professorCollapsed && (
                <div className="capture-area">
                  {professorImages.length === 0 ? (
                    <div className="empty-state">
                      <svg className="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <h4>No Professor Answer Captured</h4>
                      <p>Click the button below to capture the professor's answer from this tab</p>
                      <button 
                        className="capture-button primary"
                        onClick={() => handleCaptureClick('professor')}
                      >
                        <svg className="button-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14m-7-7h14"/>
                        </svg>
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
                        <svg className="button-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14m-7-7h14"/>
                        </svg>
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
        <div className="control-bar">
          <div className="control-bar-section">
            <button 
              className={`control-button translate-button ${canTranslateToMarkdown ? 'enabled' : 'disabled'}`}
              onClick={handleTranslateToMarkdown}
              disabled={!canTranslateToMarkdown || isConverting}
              title="Convert captured images to text"
            >
              <svg className="button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              {isConverting ? 'Converting...' : 'Translate to Markdown'}
            </button>
            
            <button 
              className={`control-button grade-button ${canStartGrading ? 'enabled' : 'disabled'}`}
              onClick={handleStartGrading}
              disabled={!canStartGrading || isProcessing}
              title="Start AI grading process"
            >
              <svg className="button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
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
                  <svg className="button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5-5 5 5m-5-5v12"/>
                  </svg>
                  Export Results
                </button>
                
                <button 
                  className="control-button reset-button"
                  onClick={() => {/* TODO: Implement reset */}}
                  title="Reset for next student"
                >
                  <svg className="button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Next Student
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="error-state">
            <div className="error-content">
              <svg className="error-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
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
                <svg className="button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Retry
              </button>
              <button 
                className="dismiss-button"
                onClick={() => setError(null)}
                title="Dismiss this error"
              >
                <svg className="button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
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
