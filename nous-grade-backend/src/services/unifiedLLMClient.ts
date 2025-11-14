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
      const parsedText = this.parseOCRResponse(extractedText);
      const confidenceScore = 0.92;

      console.log(`🔍 GPT-4o mini OCR completed in ${processingTime}ms`);
      console.log(`🔍 Extracted text length: ${parsedText.length}`);
      console.log(`🔍 Confidence (default): ${confidenceScore}`);

      return {
        id: '', // Will be set by the database
        screenshotId: '', // Will be set by the caller
        sessionId: '', // Will be set by the caller
        extractedText: parsedText,
        confidence: confidenceScore,
        processingTime,
        model: this.config.openai.model,
        processedAt: new Date(),
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
    studentText: string, 
    professorText: string, 
    options: { rubric?: string } = {}
  ): Promise<Omit<GradingResult, 'id' | 'sessionId' | 'studentOcrId' | 'professorOcrId' | 'gradedAt'>> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Starting GPT-4o mini grading analysis');
      
      const prompt = this.buildGradingPrompt(studentText, professorText, options.rubric);
      
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
   * Build OCR prompt optimized for mathematical content
   */
  private buildOCRPrompt(_type: 'student_answer' | 'professor_answer'): string {
    return `
Primary Directive: Your task is to transcribe the visual content from the provided image(s) with 100% accuracy.

Formatting Rules:
1.  Text: Transcribe all non-mathematical text using standard Markdown (e.g., for headings, lists, or plain text).
2.  Mathematics: Transcribe all mathematical equations, formulas, variables, and symbols using the appropriate LaTeX syntax.

LaTeX Delimiters:
* For inline math (mathematics mixed within a line of text), use the $...$ delimiters.
* For display math (mathematics on its own centered line), use the $$...$$ delimiters.

Strict Guardrail:
* You must only transcribe the content.
* Do not solve, simplify, explain, or answer any part of the text or equations.
* The goal is a perfect, renderable transcription that exactly matches the visual content of the image.
`;
  }

  /**
   * Build grading prompt for GPT-4o mini
   */
  private buildGradingPrompt(studentText: string, professorText: string, rubric?: string): string {
    return `You are an experienced tutor that is grading the exams of the students. You are only supposed to use the solutions that you are given and are attached below. I want you to give me the exact points that should be awarded in the student by FIRST analyzing his answer and SECOND checking them by the grading scheme.

**MODEL ANSWER**:
${professorText}

**STUDENT'S ANSWER**:
${studentText}`;
  }

  /**
   * Parse OCR response from GPT-4o mini
   */
  private parseOCRResponse(response: string): string {
    if (!response) {
      return '';
    }

    const trimmed = response.trim();

    try {
      const parsed = JSON.parse(trimmed);

      if (typeof parsed === 'string') {
        return parsed;
      }

      if (parsed && typeof parsed.text === 'string') {
        return parsed.text;
      }
    } catch {
      // Ignore JSON parsing errors; fall through to raw text
    }

    return trimmed;
  }

  /**
   * Parse grading response from GPT-4o mini
   */
  private parseGradingResponse(rawResponse: string): {
    score: number;
    maxScore: number;
    confidence: number;
    feedback: string;
    suggestedGrade: string;
    detailedAnalysis: DetailedAnalysis;
  } {
    const response = rawResponse.trim();
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
      console.warn('Failed to parse grading response as JSON, attempting heuristic parsing');

      const ratioMatch = response.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      const pointsMatch = response.match(/(\d+(?:\.\d+)?)\s*(?:points?|pts?)/i);

      let score = 0;
      let maxScore = 10;

      if (ratioMatch) {
        score = Number.parseFloat(ratioMatch[1]);
        maxScore = Number.parseFloat(ratioMatch[2]) || maxScore;
      } else if (pointsMatch) {
        score = Number.parseFloat(pointsMatch[1]);
      }

      return {
        score: Number.isFinite(score) ? score : 0,
        maxScore: Number.isFinite(maxScore) ? maxScore : 10,
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
