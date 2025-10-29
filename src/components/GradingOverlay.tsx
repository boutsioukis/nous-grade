import React, { useState, useEffect } from 'react';
import './GradingOverlay.css';

interface GradingOverlayProps {
  onClose: () => void;
}

interface CaptureState {
  student: boolean;
  professor: boolean;
}

const GradingOverlay: React.FC<GradingOverlayProps> = ({ onClose }) => {
  
  const [captureState, setCaptureState] = useState<CaptureState>({
    student: false,
    professor: false
  });
  
  const [studentImageData, setStudentImageData] = useState<string | null>(null);
  const [professorImageData, setProfessorImageData] = useState<string | null>(null);
  const [studentMarkdown, setStudentMarkdown] = useState<string | null>(null);
  const [professorMarkdown, setProfessorMarkdown] = useState<string | null>(null);
  const [gradingResult, setGradingResult] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [markdownConverted, setMarkdownConverted] = useState(false);

  // Listen for capture completion events
  useEffect(() => {
    
    const handleCaptureComplete = (event: CustomEvent) => {
      console.log('🟢 Capture completed:', event.detail);
      const { captureType, imageData, success } = event.detail;
      
      if (success && imageData) {
        setCaptureState(prev => ({ ...prev, [captureType]: true }));
        
        if (captureType === 'student') {
          setStudentImageData(imageData);
          console.log('🟢 Student image set, data length:', imageData.length);
        } else if (captureType === 'professor') {
          setProfessorImageData(imageData);
          console.log('🟢 Professor image set, data length:', imageData.length);
        }
      }
    };

    const handleCaptureError = (event: CustomEvent) => {
      console.error('🔴 Capture error:', event.detail);
      const { captureType } = event.detail;
      setCaptureState(prev => ({ ...prev, [captureType]: false }));
    };

    const handleMarkdownComplete = (event: CustomEvent) => {
      console.log('🟢 Markdown conversion completed:', event.detail);
      const { captureType, markdown, confidence, success } = event.detail;
      
      if (success && markdown) {
        if (captureType === 'student') {
          setStudentMarkdown(markdown);
          console.log('🟢 Student markdown set, length:', markdown.length);
        } else if (captureType === 'professor') {
          setProfessorMarkdown(markdown);
          console.log('🟢 Professor markdown set, length:', markdown.length);
        }
      }
      
      setIsConverting(false);
    };

    const handleProcessingUpdate = (event: CustomEvent) => {
      console.log('🟢 Processing state update received:', event.detail);
      // You can add additional state updates here if needed
    };

    const handleGradingComplete = (event: CustomEvent) => {
      console.log('🟢 Grading completed:', event.detail);
      const { result, success } = event.detail;
      
      if (success && result) {
        setGradingResult(result);
        setIsProcessing(false);
        console.log('🟢 Grading result set:', result);
      } else {
        console.error('🔴 Grading failed:', event.detail);
        setIsProcessing(false);
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
    
    // Reset markdown states when new capture starts
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

  const handleTranslateToMarkdown = async () => {
    if (!studentImageData || !professorImageData) {
      console.error('Both images must be captured before markdown conversion');
      return;
    }

    setIsConverting(true);
    console.log('🟢 Starting markdown conversion for both images');
    
    try {
      // Dispatch event to trigger markdown conversion
      const convertEvent = new CustomEvent('nous-grade-convert-to-markdown', {
        detail: { 
          studentImageData,
          professorImageData
        }
      });
      document.dispatchEvent(convertEvent);
      console.log('🟢 Markdown conversion request sent');
    } catch (error) {
      console.error('🔴 Error starting markdown conversion:', error);
      setIsConverting(false);
    }
  };

  const handleStartGrading = async () => {
    console.log('🟢 Starting grading process');
    
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
    }
  };

  const canTranslateToMarkdown = captureState.student && captureState.professor && !studentMarkdown && !professorMarkdown;
  const canStartGrading = studentMarkdown && professorMarkdown;


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
            <div className="capture-item">
              <h3>Student Answer</h3>
              <div className="capture-area">
                {studentImageData ? (
                  <div className="captured-content">
                    <div className="captured-image">
                      <img src={studentImageData} alt="Student Answer" />
                      <div className="capture-status captured">✓ Captured</div>
                    </div>
                    {studentMarkdown && (
                      <div className="markdown-content">
                        <h4>Converted Text:</h4>
                        <div className="markdown-text">{studentMarkdown}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="capture-placeholder">
                    <button 
                      className="capture-button"
                      onClick={() => handleCaptureClick('student')}
                    >
                      + Capture Student Answer
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Professor Answer Capture */}
            <div className="capture-item">
              <h3>Professor Answer</h3>
              <div className="capture-area">
                {professorImageData ? (
                  <div className="captured-content">
                    <div className="captured-image">
                      <img src={professorImageData} alt="Professor Answer" />
                      <div className="capture-status captured">✓ Captured</div>
                    </div>
                    {professorMarkdown && (
                      <div className="markdown-content">
                        <h4>Converted Text:</h4>
                        <div className="markdown-text">{professorMarkdown}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="capture-placeholder">
                    <button 
                      className="capture-button"
                      onClick={() => handleCaptureClick('professor')}
                    >
                      + Capture Professor Answer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className={`translate-button ${canTranslateToMarkdown ? 'enabled' : 'disabled'}`}
            onClick={handleTranslateToMarkdown}
            disabled={!canTranslateToMarkdown || isConverting}
          >
            {isConverting ? 'Converting...' : 'Translate to Markdown'}
          </button>
          
          <button 
            className={`grade-button ${canStartGrading ? 'enabled' : 'disabled'}`}
            onClick={handleStartGrading}
            disabled={!canStartGrading || isProcessing}
          >
            {isProcessing ? 'Grading...' : 'Start Grading'}
          </button>
        </div>

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
            <span className={`status-indicator ${captureState.student ? 'active' : 'inactive'}`}></span>
            Student Answer {captureState.student ? 'Captured' : 'Pending'}
          </div>
          <div className="status-item">
            <span className={`status-indicator ${captureState.professor ? 'active' : 'inactive'}`}></span>
            Professor Answer {captureState.professor ? 'Captured' : 'Pending'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradingOverlay;
