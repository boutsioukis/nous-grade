import React, { useEffect, useState } from 'react';
import './GradingOverlay.css';

type CaptureType = 'student' | 'professor';

interface GradingOverlayProps {
  onClose: () => void;
}

interface CaptureImage {
  id: string;
  imageData: string;
  timestamp: number;
}

interface GradingResult {
  points?: number;
  maxPoints?: number;
  suggestedGrade?: string;
  feedback?: string;
  [key: string]: unknown;
}

const CAPTURE_META: Record<CaptureType, { title: string; eyebrow: string; emptyLabel: string }> = {
  student: {
    title: 'Student Answer',
    eyebrow: 'Response',
    emptyLabel: 'Capture student answer',
  },
  professor: {
    title: 'Professor Answer',
    eyebrow: 'Reference',
    emptyLabel: 'Capture model answer',
  },
};

const isCaptureType = (value: unknown): value is CaptureType =>
  value === 'student' || value === 'professor';

const GradingOverlay: React.FC<GradingOverlayProps> = ({ onClose }) => {
  const [captures, setCaptures] = useState<Record<CaptureType, CaptureImage[]>>({
    student: [],
    professor: [],
  });
  const [markdown, setMarkdown] = useState<Record<CaptureType, string | null>>({
    student: null,
    professor: null,
  });
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Capture both answers to get started.'
  );
  const [studentPanelCollapsed, setStudentPanelCollapsed] = useState(false);
  const [professorPanelCollapsed, setProfessorPanelCollapsed] = useState(false);

  useEffect(() => {
    const handleCaptureResult = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (!isCaptureType(detail.captureType)) {
        return;
      }

      const captureType: CaptureType = detail.captureType;

      if (detail.success && detail.imageData) {
        const nextImage: CaptureImage = {
          id:
            detail.id ??
            `${captureType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          imageData: detail.imageData,
          timestamp: detail.timestamp ?? Date.now(),
        };

        setCaptures((prev) => ({
          ...prev,
          [captureType]: [...prev[captureType], nextImage],
        }));
        setMarkdown((prev) => ({
          ...prev,
          [captureType]: null,
        }));
        setGradingResult(null);
        setStatusMessage(`${CAPTURE_META[captureType].title} captured.`);
      } else if (detail.error) {
        setStatusMessage(detail.error);
      } else {
        setStatusMessage('Capture failed. Please try again.');
      }
    };

    const handleCaptureError = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (detail.error) {
        setStatusMessage(detail.error);
      }
    };

    const handleMarkdownComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (isCaptureType(detail.captureType)) {
        const captureType: CaptureType = detail.captureType;

        if (detail.success && detail.markdown) {
          setMarkdown((prev) => ({
            ...prev,
            [captureType]: detail.markdown,
          }));
          setStatusMessage(`${CAPTURE_META[captureType].title} converted to markdown.`);
        } else if (detail.error) {
          setStatusMessage(detail.error);
        }
      } else if (detail.success) {
        setStatusMessage('Markdown conversion complete.');
      }
      setIsConverting(false);
    };

    const handleProcessingUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (typeof detail.message === 'string') {
        setStatusMessage(detail.message);
      }
    };

    const handleGradingComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (detail.success && detail.result) {
        setGradingResult(detail.result);
        setStatusMessage('Grading complete.');
      } else if (detail.error) {
        setStatusMessage(detail.error);
      }
      setIsGrading(false);
    };

    document.addEventListener('nous-grade-capture-result', handleCaptureResult as EventListener);
    document.addEventListener('nous-grade-capture-error', handleCaptureError as EventListener);
    document.addEventListener('nous-grade-markdown-complete', handleMarkdownComplete as EventListener);
    document.addEventListener(
      'nous-grade-processing-update',
      handleProcessingUpdate as EventListener
    );
    document.addEventListener('nous-grade-grading-complete', handleGradingComplete as EventListener);

    return () => {
      document.removeEventListener(
        'nous-grade-capture-result',
        handleCaptureResult as EventListener
      );
      document.removeEventListener(
        'nous-grade-capture-error',
        handleCaptureError as EventListener
      );
      document.removeEventListener(
        'nous-grade-markdown-complete',
        handleMarkdownComplete as EventListener
      );
      document.removeEventListener(
        'nous-grade-processing-update',
        handleProcessingUpdate as EventListener
      );
      document.removeEventListener(
        'nous-grade-grading-complete',
        handleGradingComplete as EventListener
      );
    };
  }, []);

  const handleCapture = (captureType: CaptureType) => {
    setStatusMessage('Select the region you want to capture on the page.');
    setMarkdown((prev) => ({
      ...prev,
      [captureType]: null,
    }));
    setGradingResult(null);

    const captureEvent = new CustomEvent('nous-grade-capture-request', {
      detail: { captureType },
    });
    document.dispatchEvent(captureEvent);
  };

  const handleRemoveCapture = (captureType: CaptureType, imageId: string) => {
    setCaptures((prev) => {
      const nextImages = prev[captureType].filter((image) => image.id !== imageId);
      return {
        ...prev,
        [captureType]: nextImages,
      };
    });

    setMarkdown((prev) => ({
      ...prev,
      [captureType]: null,
    }));

    setGradingResult(null);
    setStatusMessage(`${CAPTURE_META[captureType].title} updated.`);
  };

  const handleClearCaptures = (captureType: CaptureType) => {
    setCaptures((prev) => ({
      ...prev,
      [captureType]: [],
    }));
    setMarkdown((prev) => ({
      ...prev,
      [captureType]: null,
    }));
    setGradingResult(null);
    setStatusMessage(`${CAPTURE_META[captureType].title} cleared.`);
  };

  const handleTranslateToMarkdown = () => {
    const studentImages = captures.student;
    const professorImages = captures.professor;

    if (studentImages.length === 0 || professorImages.length === 0) {
      setStatusMessage('Capture both answers before converting to markdown.');
      return;
    }

    setIsConverting(true);
    setStatusMessage('Translating images to markdown…');
    setGradingResult(null);

    const convertEvent = new CustomEvent('nous-grade-convert-to-markdown', {
      detail: {
        studentImages,
        professorImages,
      },
    });
    document.dispatchEvent(convertEvent);
  };

  const handleStartGrading = () => {
    if (!markdown.student || !markdown.professor) {
      setStatusMessage('Convert both answers to markdown before grading.');
      return;
    }

    setIsGrading(true);
    setStatusMessage('Running grading…');

    const gradingEvent = new CustomEvent('nous-grade-grading-request', { detail: {} });
    document.dispatchEvent(gradingEvent);
  };

  const hasBothCaptures = captures.student.length > 0 && captures.professor.length > 0;
  const hasMarkdown = Boolean(markdown.student && markdown.professor);

  const renderCaptureCard = (captureType: CaptureType) => {
    const captureList = captures[captureType];
    const markdownText = markdown[captureType];
    const meta = CAPTURE_META[captureType];

    return (
      <section key={captureType} className="capture-card">
        <header className="capture-card__header">
          <div>
            <p className="capture-card__eyebrow">{meta.eyebrow}</p>
            <h3 className="capture-card__title">{meta.title}</h3>
          </div>
          {captureList.length > 0 && (
            <div className="capture-card__headerActions">
              <span className="capture-card__badge">{captureList.length}</span>
              <button
                type="button"
                className="link-button"
                onClick={() => handleCapture(captureType)}
              >
                Add another
              </button>
              <button
                type="button"
                className="link-button link-button--muted"
                onClick={() => handleClearCaptures(captureType)}
              >
                Clear all
              </button>
            </div>
          )}
        </header>

        <div className="capture-card__body">
          {captureList.length === 0 ? (
            <button
              type="button"
              className="capture-trigger"
              onClick={() => handleCapture(captureType)}
            >
              {meta.emptyLabel}
            </button>
          ) : (
            <>
              <div className="capture-card__gallery">
                {captureList.map((image, index) => (
                  <div key={image.id} className="capture-card__item">
                    <div className="capture-card__thumb">
                      <img src={image.imageData} alt={`${meta.title} ${index + 1}`} />
                    </div>
                    <div className="capture-card__itemFooter">
                      <span className="capture-card__itemLabel">Image {index + 1}</span>
                      <button
                        type="button"
                        className="ghost-button ghost-button--small"
                        onClick={() => handleRemoveCapture(captureType, image.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleCapture(captureType)}
              >
                Add another capture
              </button>
            </>
          )}
        </div>

        {markdownText && (
          <div className="markdown-block">
            <p className="markdown-block__label">Extracted text</p>
            <pre className="markdown-block__content">{markdownText}</pre>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="grading-overlay">
      <div className={`floating-panel left ${studentPanelCollapsed ? 'collapsed' : ''}`}>
        {studentPanelCollapsed ? (
          <button
            type="button"
            className="floating-panel__toggle floating-panel__toggle--left"
            onClick={() => setStudentPanelCollapsed(false)}
          >
            Student Answer
          </button>
        ) : (
          <div className="floating-panel__container">
            <header className="floating-panel__header">
              <div className="floating-panel__titles">
                <p className="panel-eyebrow">Student</p>
                <h2 className="panel-heading">Student Answer</h2>
              </div>
              <button
                type="button"
                className="collapse-button"
                onClick={() => setStudentPanelCollapsed(true)}
              >
                Hide
              </button>
            </header>
            <div className="floating-panel__body">{renderCaptureCard('student')}</div>
          </div>
        )}
      </div>

      <div className={`floating-panel right ${professorPanelCollapsed ? 'collapsed' : ''}`}>
        {professorPanelCollapsed ? (
          <button
            type="button"
            className="floating-panel__toggle floating-panel__toggle--right"
            onClick={() => setProfessorPanelCollapsed(false)}
          >
            Professor Answer
          </button>
        ) : (
          <div className="floating-panel__container">
            <header className="floating-panel__header">
              <div className="floating-panel__titles">
                <p className="panel-eyebrow">Professor</p>
                <h2 className="panel-heading">Professor Answer</h2>
              </div>
              <div className="floating-panel__actions">
                <button
                  type="button"
                  className="collapse-button"
                  onClick={() => setProfessorPanelCollapsed(true)}
                >
                  Hide
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={onClose}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </header>
            <div className="floating-panel__body">
              {renderCaptureCard('professor')}

              <div className="panel-status">
                <p className="status-message">{statusMessage}</p>
              </div>

              <div className="panel-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleTranslateToMarkdown}
                  disabled={!hasBothCaptures || isConverting}
                >
                  {isConverting ? 'Converting…' : 'Translate to Markdown'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleStartGrading}
                  disabled={!hasMarkdown || isGrading || isConverting}
                >
                  {isGrading ? 'Grading…' : 'Run Grading'}
                </button>
              </div>

              {gradingResult && (gradingResult.suggestedGrade || gradingResult.feedback) && (
                <section className="grading-result">
                  <header className="grading-result__header">
                    <p className="grading-result__title">Suggested Grade</p>
                  </header>
                  <div className="grading-result__body">
                    <div className="grading-result__section">
                      <p className="grading-result__text">
                        {gradingResult.suggestedGrade || gradingResult.feedback}
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradingOverlay;