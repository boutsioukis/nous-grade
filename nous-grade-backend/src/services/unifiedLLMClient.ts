// Unified LLM Client for orchestrating different AI models
// GPT-4o mini for OCR, Claude 4 Opus for grading, Claude Sonnet 4 for feedback

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { OCRResult, GradingResult, DetailedAnalysis } from '../types';

export interface LLMConfig {
  openai: {
    apiKey: string;
    model: string; // 'gpt-4o-mini'
  };
  anthropic: {
    apiKey: string;
    gradingModel: string; // 'claude-3-5-sonnet-20241022'
    feedbackModel: string; // 'claude-3-5-sonnet-20241022'
  };
}

export class UnifiedLLMClient {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
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
   * Grade student answer using Claude 4 Opus
   * Provides comprehensive analysis and scoring
   */
  async gradeAnswer(
    studentOCR: OCRResult, 
    professorOCR: OCRResult, 
    rubric?: string
  ): Promise<Omit<GradingResult, 'id' | 'sessionId' | 'studentOcrId' | 'professorOcrId' | 'gradedAt'>> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Starting Claude 4 Opus grading analysis');
      
      const prompt = this.buildGradingPrompt(studentOCR.extractedText, professorOCR.extractedText, rubric);
      
      const response = await this.anthropic.messages.create({
        model: this.config.anthropic.gradingModel,
        max_tokens: 3000,
        temperature: 0.2, // Low temperature for consistent grading
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const gradingResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      const processingTime = Date.now() - startTime;

      // Parse the structured grading response
      const parsedGrading = this.parseGradingResponse(gradingResponse);

      console.log(`🎯 Claude 4 Opus grading completed in ${processingTime}ms`);
      console.log(`🎯 Score: ${parsedGrading.score}/${parsedGrading.maxScore}`);
      console.log(`🎯 Confidence: ${parsedGrading.confidence}`);

      return {
        score: parsedGrading.score,
        maxScore: parsedGrading.maxScore,
        feedback: parsedGrading.feedback,
        detailedAnalysis: parsedGrading.detailedAnalysis,
        confidence: parsedGrading.confidence,
        processingTime,
        model: this.config.anthropic.gradingModel
      };

    } catch (error) {
      console.error('🔴 Claude 4 Opus grading failed:', error);
      throw new Error(`Grading processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate enhanced feedback using Claude Sonnet 4
   * Provides detailed, constructive feedback for students
   */
  async generateFeedback(
    gradingResult: Partial<GradingResult>,
    studentOCR: OCRResult,
    professorOCR: OCRResult
  ): Promise<string> {
    try {
      console.log('📝 Starting Claude Sonnet 4 feedback generation');
      
      const prompt = this.buildFeedbackPrompt(gradingResult, studentOCR.extractedText, professorOCR.extractedText);
      
      const response = await this.anthropic.messages.create({
        model: this.config.anthropic.feedbackModel,
        max_tokens: 2000,
        temperature: 0.3, // Slightly higher for more natural feedback
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const enhancedFeedback = response.content[0].type === 'text' ? response.content[0].text : '';
      
      console.log('📝 Claude Sonnet 4 feedback generation completed');
      console.log(`📝 Feedback length: ${enhancedFeedback.length}`);

      return enhancedFeedback;

    } catch (error) {
      console.error('🔴 Claude Sonnet 4 feedback generation failed:', error);
      // Return the original feedback if enhancement fails
      return gradingResult.feedback || 'Feedback generation failed';
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
   * Build grading prompt for Claude 4 Opus
   */
  private buildGradingPrompt(studentText: string, professorText: string, rubric?: string): string {
    return `You are an expert academic grader with deep expertise in mathematics and educational assessment.

**TASK**: Grade the student's answer by comparing it to the professor's model answer.

**PROFESSOR'S MODEL ANSWER**:
${professorText}

**STUDENT'S ANSWER**:
${studentText}

**GRADING RUBRIC** (if provided):
${rubric || 'Use standard academic grading criteria focusing on correctness, methodology, and clarity.'}

**INSTRUCTIONS**:
1. Analyze the student's approach and methodology
2. Check mathematical accuracy and calculations
3. Evaluate clarity of explanation and presentation
4. Compare against the professor's model answer
5. Provide constructive feedback for improvement

Return your response in this JSON format:
{
  "score": 8,
  "maxScore": 10,
  "confidence": 0.92,
  "feedback": "Overall assessment summary",
  "detailedAnalysis": {
    "strengths": ["List of what the student did well"],
    "weaknesses": ["Areas needing improvement"],
    "suggestions": ["Specific recommendations"],
    "rubricBreakdown": [
      {
        "criterion": "Mathematical Accuracy",
        "points": 4,
        "maxPoints": 4,
        "feedback": "Specific feedback for this criterion"
      }
    ],
    "comparisonNotes": "How the student's answer compares to the model answer"
  }
}

Be fair, constructive, and specific in your assessment.`;
  }

  /**
   * Build feedback prompt for Claude Sonnet 4
   */
  private buildFeedbackPrompt(
    gradingResult: Partial<GradingResult>,
    studentText: string,
    professorText: string
  ): string {
    return `You are an expert educational feedback specialist. Your role is to transform grading analysis into encouraging, constructive feedback that helps students learn and improve.

**GRADING ANALYSIS**:
Score: ${gradingResult.score}/${gradingResult.maxScore}
Original Feedback: ${gradingResult.feedback}
Detailed Analysis: ${JSON.stringify(gradingResult.detailedAnalysis, null, 2)}

**STUDENT'S WORK**:
${studentText}

**MODEL ANSWER**:
${professorText}

**TASK**: Create enhanced, student-friendly feedback that:
1. Starts with positive reinforcement
2. Explains what was done well specifically
3. Identifies areas for improvement with clear explanations
4. Provides actionable suggestions for next steps
5. Maintains an encouraging, supportive tone
6. Uses clear, accessible language

Focus on helping the student understand not just what was wrong, but WHY and HOW to improve. Make the feedback motivational and educational.

Return only the enhanced feedback text (no JSON formatting).`;
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
   * Parse grading response from Claude 4 Opus
   */
  private parseGradingResponse(response: string): {
    score: number;
    maxScore: number;
    confidence: number;
    feedback: string;
    detailedAnalysis: DetailedAnalysis;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        score: parsed.score || 0,
        maxScore: parsed.maxScore || 10,
        confidence: parsed.confidence || 0.8,
        feedback: parsed.feedback || '',
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
