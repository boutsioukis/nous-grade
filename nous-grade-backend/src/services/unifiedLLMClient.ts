// Unified LLM Client for orchestrating different AI models
// GPT-4o mini for OCR, grading, and feedback

import OpenAI from 'openai';
import { OCRResult, GradingResult, DetailedAnalysis } from '../types';

export interface LLMConfig {
  openai: {
    apiKey: string;
    model: string; // 'gpt-4o-mini' for OCR, grading, and feedback
  };
}

export class UnifiedLLMClient {
  private openai: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * Extract text from image using GPT-4o mini
   * Optimized for mathematical content and handwritten text
   */
  async extractTextFromImage(imageData: string, type: 'student_answer' | 'professor_answer'): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Starting GPT-4o mini OCR for ${type}`);
      
      const prompt = this.buildOCRPrompt(type);
      
      const response = await this.openai.chat.completions.create({
        model: this.config.openai.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for accuracy
      });

      const extractedText = response.choices[0]?.message?.content || '';
      const processingTime = Date.now() - startTime;

      // Parse the structured response
      const parsedResult = this.parseOCRResponse(extractedText);

      console.log(`🔍 GPT-4o mini OCR completed in ${processingTime}ms`);
      console.log(`🔍 Extracted text length: ${parsedResult.text.length}`);
      console.log(`🔍 Confidence: ${parsedResult.confidence}`);

      return {
        id: '', // Will be set by the database
        screenshotId: '', // Will be set by the caller
        sessionId: '', // Will be set by the caller
        extractedText: parsedResult.text,
        confidence: parsedResult.confidence,
        processingTime,
        model: this.config.openai.model,
        processedAt: new Date(),
        metadata: {
          textBlocks: parsedResult.textBlocks,
          detectedLanguage: parsedResult.language,
          mathContent: parsedResult.hasMath,
          handwritingDetected: parsedResult.hasHandwriting
        }
      };

    } catch (error) {
      console.error('🔴 GPT-4o mini OCR failed:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Grade student answer using GPT-4o mini
   * Provides comprehensive analysis and scoring
   */
  async gradeAnswer(
    studentOCR: OCRResult, 
    professorOCR: OCRResult, 
    rubric?: string
  ): Promise<Omit<GradingResult, 'id' | 'sessionId' | 'studentOcrId' | 'professorOcrId' | 'gradedAt'>> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Starting GPT-4o mini grading analysis');
      
      const prompt = this.buildGradingPrompt(studentOCR.extractedText, professorOCR.extractedText, rubric);
      
      const response = await this.openai.chat.completions.create({
        model: this.config.openai.model,
        max_tokens: 3000,
        temperature: 0.2, // Low temperature for consistent grading
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const gradingResponse = response.choices[0]?.message?.content || '';
      const processingTime = Date.now() - startTime;

      // Parse the structured grading response
      const parsedGrading = this.parseGradingResponse(gradingResponse);

      console.log(`🎯 GPT-4o mini grading completed in ${processingTime}ms`);
      console.log(`🎯 Score: ${parsedGrading.score}/${parsedGrading.maxScore}`);
      console.log(`🎯 Confidence: ${parsedGrading.confidence}`);

      return {
        score: parsedGrading.score,
        maxScore: parsedGrading.maxScore,
        feedback: parsedGrading.feedback,
        suggestedGrade: parsedGrading.suggestedGrade,
        detailedAnalysis: parsedGrading.detailedAnalysis,
        confidence: parsedGrading.confidence,
        processingTime,
        model: this.config.openai.model
      };

    } catch (error) {
      console.error('🔴 GPT-4o mini grading failed:', error);
      throw new Error(`Grading processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a concise suggested grade message using GPT-4o mini
   * Output is designed for quick copy/paste into student feedback
   */
  async generateSuggestedGrade(
    gradingResult: Partial<GradingResult>,
    studentOCR: OCRResult,
    professorOCR: OCRResult
  ): Promise<string> {
    try {
      console.log('📝 Starting GPT-4o mini suggested grade generation');

      const prompt = this.buildSuggestedGradePrompt(gradingResult, studentOCR.extractedText, professorOCR.extractedText);

      const response = await this.openai.chat.completions.create({
        model: this.config.openai.model,
        max_tokens: 1200,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const suggestedGrade = response.choices[0]?.message?.content || '';

      console.log('📝 GPT-4o mini suggested grade generation completed');
      console.log(`📝 Suggested grade length: ${suggestedGrade.length}`);

      return suggestedGrade.trim();
    } catch (error) {
      console.error('🔴 GPT-4o mini suggested grade generation failed:', error);
      return gradingResult.feedback || 'Suggested grade unavailable.';
    }
  }

  /**
   * Build OCR prompt optimized for mathematical content
   */
  private buildOCRPrompt(type: 'student_answer' | 'professor_answer'): string {
    return `You are an expert OCR system specialized in extracting text from academic content, particularly mathematical problems and solutions.

Please analyze this image of a ${type.replace('_', ' ')} and extract ALL text content with high accuracy. Pay special attention to:

1. **Mathematical expressions**: Equations, formulas, variables, operators
2. **Handwritten text**: Both printed and cursive handwriting
3. **Numerical values**: Numbers, fractions, decimals
4. **Step-by-step solutions**: Organized problem-solving steps
5. **Diagrams and labels**: Any text within diagrams or figures

Return your response in this JSON format:
{
  "text": "Complete extracted text preserving structure and formatting",
  "confidence": 0.95,
  "language": "en",
  "hasMath": true,
  "hasHandwriting": false,
  "textBlocks": [
    {
      "text": "Individual text segment",
      "confidence": 0.98,
      "type": "text|math|diagram"
    }
  ]
}

Focus on accuracy over speed. If mathematical notation is unclear, provide your best interpretation with a note about uncertainty.`;
  }

  /**
   * Build grading prompt for GPT-4o mini
   */
  private buildGradingPrompt(studentText: string, professorText: string, rubric?: string): string {
    return `You are an expert academic grader with deep expertise in mathematics and educational assessment.

**TASK**: Grade the student's answer by comparing it to the professor's model answer.

**PROFESSOR'S MODEL ANSWER**:
${professorText}

**STUDENT'S ANSWER**:
${studentText}

**INSTRUCTIONS**:
1. Analyze the student's approach and methodology
2. Check mathematical accuracy and calculations
3. Evaluate clarity of explanation and presentation
4. Compare against the professor's model answer
5. Provide constructive feedback for improvement
6. Keep rubric reasoning concise (one to two sentences per criterion) and explicitly reference the professor answer when explaining deductions or credit.

Return your response in this JSON format:
{
  "score": 8,
  "maxScore": 10,
  "confidence": 0.92,
  "feedback": "Overall assessment summary (for internal use)",
  "suggestedGrade": "Suggested grade: 8/10 – Short summary sentence.\n• Criterion (points/max): concise reason tied to professor answer\n• ...\nNext step: short encouragement.",
  "detailedAnalysis": {
    "strengths": ["List of what the student did well"],
    "weaknesses": ["Areas needing improvement"],
    "suggestions": ["Specific recommendations"],
    "rubricBreakdown": [
      {
        "criterion": "Mathematical Accuracy",
        "points": 4,
        "maxPoints": 4,
        "feedback": "Brief (<=20 words) explanation referencing the professor answer"
      }
    ],
    "comparisonNotes": "How the student's answer compares to the model answer"
  }
}

Be fair, constructive, and specific in your assessment.`;
  }

  /**
   * Build suggested grade prompt for GPT-4o mini
   */
  private buildSuggestedGradePrompt(
    gradingResult: Partial<GradingResult>,
    studentText: string,
    professorText: string
  ): string {
    const rubricBreakdown = gradingResult.detailedAnalysis?.rubricBreakdown ?? [];

    return `You are assisting a professor who has already reviewed the following grading analysis. Write a concise suggested grade message they can copy and paste into the student's feedback box.

INPUT DATA (for your reference):
- Score: ${gradingResult.score}/${gradingResult.maxScore}
- Confidence: ${gradingResult.confidence ?? 'N/A'}
- Rubric Breakdown: ${JSON.stringify(rubricBreakdown)}
- Professor Model Answer: ${professorText}
- Student Answer: ${studentText}

REQUIREMENTS:
1. Begin with a single line in the format: "Suggested grade: ${gradingResult.score}/${gradingResult.maxScore} – <very short summary>."
2. Follow with short bullet points (one per rubric item) using the criterion names from the rubric breakdown. Format as "• Criterion (points/max): brief reason referencing the professor answer".
3. Each reason must explicitly mention what the student did relative to the professor's answer (e.g., "matched the derivative steps shown by the professor", "omitted the justification for ...").
4. Keep the entire message under 120 words and avoid markdown headers or numbered lists—only the opening sentence and bullet points.
5. End with one short sentence encouraging the student on the next step (e.g., "Focus next on ...").

The tone should be professional, supportive, and immediately usable without editing. Return plain text only.`;
  }

  /**
   * Parse OCR response from GPT-4o mini
   */
  private parseOCRResponse(response: string): {
    text: string;
    confidence: number;
    language: string;
    hasMath: boolean;
    hasHandwriting: boolean;
    textBlocks: any[];
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        text: parsed.text || '',
        confidence: parsed.confidence || 0.8,
        language: parsed.language || 'en',
        hasMath: parsed.hasMath || false,
        hasHandwriting: parsed.hasHandwriting || false,
        textBlocks: parsed.textBlocks || []
      };
    } catch (error) {
      console.warn('Failed to parse OCR response as JSON, using raw text');
      return {
        text: response,
        confidence: 0.7,
        language: 'en',
        hasMath: response.includes('=') || /\d+/.test(response),
        hasHandwriting: false,
        textBlocks: [{ text: response, confidence: 0.7, type: 'text' }]
      };
    }
  }

  /**
   * Parse grading response from GPT-4o mini
   */
  private parseGradingResponse(response: string): {
    score: number;
    maxScore: number;
    confidence: number;
    feedback: string;
    suggestedGrade: string;
    detailedAnalysis: DetailedAnalysis;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        score: parsed.score || 0,
        maxScore: parsed.maxScore || 10,
        confidence: parsed.confidence || 0.8,
        feedback: parsed.feedback || '',
        suggestedGrade: parsed.suggestedGrade || parsed.feedback || '',
        detailedAnalysis: parsed.detailedAnalysis || {
          strengths: [],
          weaknesses: [],
          suggestions: [],
          rubricBreakdown: [],
          comparisonNotes: ''
        }
      };
    } catch (error) {
      console.warn('Failed to parse grading response as JSON, using fallback');
      return {
        score: 0,
        maxScore: 10,
        confidence: 0.5,
        feedback: response,
        suggestedGrade: response,
        detailedAnalysis: {
          strengths: [],
          weaknesses: [],
          suggestions: [],
          rubricBreakdown: [],
          comparisonNotes: response
        }
      };
    }
  }
}
