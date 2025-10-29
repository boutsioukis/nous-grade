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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

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

    // Add event listeners
    document.addEventListener('nous-grade-capture-result', handleCaptureComplete as EventListener);
    document.addEventListener('nous-grade-capture-error', handleCaptureError as EventListener);

    // Cleanup
    return () => {
      document.removeEventListener('nous-grade-capture-result', handleCaptureComplete as EventListener);
      document.removeEventListener('nous-grade-capture-error', handleCaptureError as EventListener);
    };
  }, []);

  const handleCaptureClick = async (type: 'student' | 'professor') => {
    console.log(`🟢 Starting capture for ${type}`);
    
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

  const canTranslateToMarkdown = captureState.student && captureState.professor;
  const canStartGrading = canTranslateToMarkdown; // For now, same condition

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
                  <div className="captured-image">
                    <img src={studentImageData} alt="Student Answer" />
                    <div className="capture-status captured">✓ Captured</div>
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
                  <div className="captured-image">
                    <img src={professorImageData} alt="Professor Answer" />
                    <div className="capture-status captured">✓ Captured</div>
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
