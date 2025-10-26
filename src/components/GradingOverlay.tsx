import React, { useState } from 'react';
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

  const handleCaptureClick = async (type: 'student' | 'professor') => {
    console.log(`Starting capture for ${type}`);
    
    // Send message to service worker to start capture
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_CAPTURE',
        captureType: type
      });
      
      if (response.success) {
        setCaptureState(prev => ({ ...prev, [type]: true }));
        
        // Simulate image data for now (will be replaced with actual capture)
        const mockImageData = `data:image/png;base64,mock-${type}-image-data`;
        if (type === 'student') {
          setStudentImageData(mockImageData);
        } else {
          setProfessorImageData(mockImageData);
        }
      }
    } catch (error) {
      console.error('Error starting capture:', error);
    }
  };

  const handleStartGrading = async () => {
    if (!studentImageData || !professorImageData) {
      console.error('Both images must be captured before grading');
      return;
    }

    setIsProcessing(true);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_GRADING',
        studentImageData,
        professorImageData
      });
      
      console.log('Grading started:', response);
    } catch (error) {
      console.error('Error starting grading:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const canStartGrading = captureState.student && captureState.professor;

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
            className={`grade-button ${canStartGrading ? 'enabled' : 'disabled'}`}
            onClick={handleStartGrading}
            disabled={!canStartGrading || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Start Grading'}
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
