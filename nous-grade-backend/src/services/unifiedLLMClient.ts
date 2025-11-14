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
    return `You are an experienced tutor that is grading the exams of the students. You are only supposed to use the solutions that you are given and are attached below. I want you to give me the exact points that should be awared in the student by FIRST analyzing his answer and SECOND checking them by the grading scheme.

**MODEL ANSWER**:
${professorText}

**STUDENT'S ANSWER**:
${studentText}`;
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
