// Mock backend service for testing Phase 4 functionality
// This simulates the real backend API responses

import { 
  ImageToMarkdownRequest, 
  ImageToMarkdownResponse,
  GradeAnswerRequest,
  GradeAnswerResponse
} from '../types/backend';

export class MockBackendService {
  
  /**
   * Mock image to markdown conversion
   */
  async convertImageToMarkdown(request: ImageToMarkdownRequest): Promise<ImageToMarkdownResponse> {
    console.log('🟡 Mock: Converting image to markdown for:', request.type);
    
    // Simulate API delay
    await this.delay(2000 + Math.random() * 3000);
    
    // Generate mock markdown based on type
    const mockMarkdown = this.generateMockMarkdown(request.type);
    
    return {
      markdown: mockMarkdown,
      confidence: 0.85 + Math.random() * 0.15, // 85-100% confidence
      processingTime: 2500,
      success: true
    };
  }

  /**
   * Mock AI grading
   */
  async gradeAnswer(request: GradeAnswerRequest): Promise<GradeAnswerResponse> {
    console.log('🟡 Mock: Grading student answer');
    
    // Simulate AI processing delay
    await this.delay(3000 + Math.random() * 4000);
    
    // Generate mock grading result
    const mockResult = this.generateMockGradingResult(request);
    
    return {
      ...mockResult,
      processingTime: 4200,
      success: true
    };
  }

  /**
   * Generate mock markdown content
   */
  private generateMockMarkdown(type: 'student' | 'professor'): string {
    if (type === 'student') {
      return `# Student Answer

## Question Analysis
The student has attempted to solve the problem by:

1. **Identifying key variables**: The student correctly identified the main variables in the problem
2. **Setting up equations**: Basic equation setup is present
3. **Calculation steps**: Shows work for most calculations

## Solution Steps
\`\`\`
Given: x = 5, y = 3
Find: z = x² + 2y

Step 1: Calculate x²
x² = 5² = 25

Step 2: Calculate 2y
2y = 2 × 3 = 6

Step 3: Add results
z = 25 + 6 = 31
\`\`\`

## Final Answer
z = 31

## Notes
- Shows understanding of basic algebraic operations
- Work is clearly presented
- Minor calculation error in step 2 (should be 2y = 6, not 7)`;
    } else {
      return `# Professor Model Answer

## Complete Solution

### Problem Statement
Given x = 5 and y = 3, find z = x² + 2y

### Detailed Solution
\`\`\`
Step 1: Substitute given values
x = 5, y = 3
z = x² + 2y

Step 2: Calculate x²
x² = 5² = 25

Step 3: Calculate 2y
2y = 2 × 3 = 6

Step 4: Sum the results
z = x² + 2y = 25 + 6 = 31
\`\`\`

### Final Answer
**z = 31**

### Grading Criteria
- Correct identification of variables (2 points)
- Proper equation setup (2 points)
- Accurate calculations (4 points)
- Clear presentation (2 points)
- **Total: 10 points**

### Common Mistakes to Watch For
- Calculation errors in squaring
- Incorrect order of operations
- Missing units or final answer`;
    }
  }

  /**
   * Generate mock grading result
   */
  private generateMockGradingResult(request: GradeAnswerRequest): Omit<GradeAnswerResponse, 'processingTime' | 'success'> {
    // Simulate different grading scenarios
    const scenarios = [
      {
        points: 8,
        reasoning: "Student demonstrated good understanding of the fundamental concepts and showed clear work. However, there was a minor calculation error in step 2 that affected the final answer.",
        feedback: "Excellent approach! Just double-check your arithmetic in step 2. The method is correct.",
        confidence: 0.92
      },
      {
        points: 6,
        reasoning: "Student showed partial understanding but missed key steps in the solution process. The final answer is incorrect due to conceptual errors.",
        feedback: "Good start, but review the order of operations and make sure to show all steps clearly.",
        confidence: 0.88
      },
      {
        points: 9,
        reasoning: "Nearly perfect solution with clear methodology and correct calculations. Minor presentation issues but excellent mathematical understanding.",
        feedback: "Outstanding work! Just organize your steps a bit more clearly for full marks.",
        confidence: 0.95
      }
    ];

    // Randomly select a scenario (in real implementation, this would be AI-determined)
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    return {
      gradedAnswer: this.generateGradedAnswer(request.studentAnswer, scenario.points),
      points: scenario.points,
      maxPoints: request.maxPoints || 10,
      reasoning: scenario.reasoning,
      feedback: scenario.feedback,
      confidence: scenario.confidence
    };
  }

  /**
   * Generate graded answer with annotations
   */
  private generateGradedAnswer(studentAnswer: string, points: number): string {
    return `# Graded Student Answer (${points}/10 points)

${studentAnswer}

---

## AI Grading Analysis

### Strengths ✅
- Clear problem identification
- Systematic approach to solution
- Shows work step by step

### Areas for Improvement ⚠️
- Minor calculation error in step 2
- Could benefit from more detailed explanations

### Grade Breakdown
- **Problem Setup**: 2/2 points ✅
- **Method**: 2/2 points ✅  
- **Calculations**: 3/4 points ⚠️ (minor error)
- **Presentation**: 1/2 points ⚠️ (could be clearer)

**Total: ${points}/10 points**`;
  }

  /**
   * Simulate network delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check (always returns healthy for mock)
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    await this.delay(500);
    return {
      healthy: true,
      message: 'Mock backend healthy (v1.0.0-mock)'
    };
  }
}

// Export singleton instance
export const mockBackend = new MockBackendService();
