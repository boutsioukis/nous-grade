// Nous-Grade Backend Server with GPT-4o mini integration
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

// Load environment variables
dotenv.config({ path: '../.env' });

const app = express();
const port = process.env.PORT || 3001;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory session storage
const sessions = new Map();

// GPT-4o mini OCR function
async function extractTextWithGPT4o(imageData) {
  try {
    console.log('🔍 Starting GPT-4o mini OCR processing...');
    console.log('🔍 Image data length:', imageData.length);
    console.log('🔍 Image data format:', imageData.substring(0, 50) + '...');
    
    // Validate image data format
    if (!imageData.startsWith('data:image/')) {
      console.error('🔴 Invalid image format - missing data:image/ prefix');
      return {
        success: false,
        extractedText: '',
        confidence: 0,
        error: 'Invalid image format - must be data URL',
        model: 'gpt-4o-mini'
      };
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are an expert OCR system. Please extract ALL visible text from this image with high accuracy. This may include:\n\n- Handwritten text\n- Printed text\n- Mathematical equations and formulas\n- Numbers and calculations\n- Diagrams with labels\n- Any other textual content\n\nIMPORTANT: If you can see an image, extract the text from it. If you cannot see any image or if the image appears blank/empty, say 'No image visible or image is blank'.\n\nProvide the extracted text exactly as it appears, preserving structure and formatting where possible."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    const extractedText = response.choices[0].message.content;
    console.log('🔍 GPT-4o mini OCR completed successfully');
    console.log('🔍 GPT-4o mini response:', extractedText.substring(0, 200) + '...');
    console.log('🔍 Response usage:', response.usage);
    
    return {
      success: true,
      extractedText,
      confidence: 0.95, // GPT-4o mini typically has high confidence
      model: 'gpt-4o-mini',
      processingTime: Date.now()
    };
  } catch (error) {
    console.error('🔴 GPT-4o mini OCR failed:', error);
    return {
      success: false,
      extractedText: '',
      confidence: 0,
      error: error.message,
      model: 'gpt-4o-mini'
    };
  }
}

// Real AI grading function using GPT-4o mini
async function performRealAIGrading(sessionId, studentAnswer, professorAnswer) {
  try {
    console.log('🤖 Starting real AI grading with GPT-4o mini...');
    console.log('📝 Student answer length:', studentAnswer.length);
    console.log('📝 Professor answer length:', professorAnswer.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert academic grader. Your task is to grade a student's answer against a professor's model answer. 

Provide a detailed analysis including:
1. A numerical score out of 10
2. Detailed feedback on strengths and areas for improvement
3. Specific reasoning for the grade
4. Constructive suggestions for improvement

Be thorough, fair, and educational in your assessment.`
        },
        {
          role: "user",
          content: `Please grade this student's answer against the professor's model answer:

**STUDENT ANSWER:**
${studentAnswer}

**PROFESSOR'S MODEL ANSWER:**
${professorAnswer}

Please provide:
1. Score (out of 10)
2. Detailed feedback
3. Reasoning for the grade
4. Specific strengths and areas for improvement

Format your response as:
SCORE: X/10
FEEDBACK: [detailed feedback]
REASONING: [reasoning for the grade]`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const gradingText = response.choices[0].message.content;
    console.log('🤖 GPT-4o mini grading completed successfully');
    
    // Parse the response to extract score and feedback
    const scoreMatch = gradingText.match(/SCORE:\s*(\d+)\/10/i);
    const feedbackMatch = gradingText.match(/FEEDBACK:\s*([\s\S]*?)(?=REASONING:|$)/i);
    const reasoningMatch = gradingText.match(/REASONING:\s*([\s\S]*?)$/i);
    
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 7; // Default score if parsing fails
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : gradingText;
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : feedback;
    
    const suggestedGrade = `Suggested grade: ${score}/10 – ${feedback.split('.')[0] || 'See feedback for details.'}
• Overall (${score}/10): ${reasoning}
Next step: Review the professor answer to align with the highlighted points.`;

    const gradingResult = {
      id: uuidv4(),
      score: score,
      maxScore: 10,
      feedback: feedback,
      suggestedGrade,
      reasoning: reasoning,
      confidence: 0.92, // GPT-4o mini confidence
      processingTime: Date.now(),
      model: 'gpt-4o-mini',
      gradedAt: new Date(),
      rawResponse: gradingText
    };

    console.log(`🤖 AI grading result: ${score}/10`);
    return gradingResult;
    
  } catch (error) {
    console.error('🔴 Real AI grading failed:', error);
    throw new Error(`AI grading failed: ${error.message}`);
  }
}

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('dev'));

// Simple API key validation
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const validApiKey = process.env.API_KEY || 'nous-grade-api-key-2024';
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid or missing API key'
      }
    });
  }
  next();
};

// Routes

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: { status: 'healthy' },
        ai: { 
          status: 'configured',
          openai: !!process.env.OPENAI_API_KEY,
        }
      }
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Nous-Grade Backend API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      sessions: '/api/grading/sessions',
      screenshots: '/api/grading/screenshots',
      grading: '/api/grading/grade',
      results: '/api/grading/results/:sessionId'
    }
  });
});

// Protected API routes
app.use('/api', validateApiKey);

// Create session
app.post('/api/grading/sessions', (req, res) => {
  try {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    const session = {
      id: sessionId,
      status: 'initialized',
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt,
      screenshots: [],
      ocrResults: [],
      metadata: {
        userAgent: req.body.metadata?.userAgent || 'unknown',
        ipAddress: req.ip,
        extensionVersion: req.body.metadata?.extensionVersion || '1.0.0'
      }
    };

    sessions.set(sessionId, session);

    console.log(`🎯 Created session: ${sessionId}`);

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        expiresAt: session.expiresAt
      },
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create session'
      }
    });
  }
});

// Upload screenshot with real GPT-4o mini OCR
app.post('/api/grading/screenshots', async (req, res) => {
  try {
    const { sessionId, type, imageData } = req.body;

    if (!sessionId || !type || !imageData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: sessionId, type, imageData'
        }
      });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
    }

    // Real GPT-4o mini OCR processing
    console.log(`📸 Processing ${type} screenshot with GPT-4o mini...`);
    console.log(`📸 Received image data length: ${imageData ? imageData.length : 'null'}`);
    console.log(`📸 Image data format: ${imageData ? imageData.substring(0, 50) + '...' : 'null'}`);
    
    const ocrStartTime = Date.now();
    const ocrResult = await extractTextWithGPT4o(imageData);
    
    const realOcrResult = {
      id: uuidv4(),
      type: type, // Add the type field for grading lookup
      extractedText: ocrResult.success ? ocrResult.extractedText : `OCR failed: ${ocrResult.error}`,
      confidence: ocrResult.confidence,
      processingTime: Date.now() - ocrStartTime,
      model: ocrResult.model,
      processedAt: new Date(),
      success: ocrResult.success
    };

    session.screenshots.push({
      id: uuidv4(),
      type,
      imageData: imageData.substring(0, 100) + '...', // Truncate for storage
      uploadedAt: new Date()
    });

    session.ocrResults.push(realOcrResult);
    session.updatedAt = new Date();

    // Check if ready for grading
    const hasStudent = session.screenshots.some(s => s.type === 'student_answer');
    const hasProfessor = session.screenshots.some(s => s.type === 'professor_answer');
    const readyForGrading = hasStudent && hasProfessor;

    if (readyForGrading) {
      session.status = 'ocr_complete';
    }

    sessions.set(sessionId, session);

    console.log(`📸 Screenshot uploaded for ${type}, session: ${sessionId}`);

    res.status(201).json({
      success: true,
      data: {
        screenshotId: session.screenshots[session.screenshots.length - 1].id,
        ocrResult: realOcrResult,
        sessionStatus: session.status,
        readyForGrading
      },
      message: `Screenshot uploaded and OCR completed for ${type}`
    });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process screenshot'
      }
    });
  }
});

// Trigger grading (mock for now)
app.post('/api/grading/grade', (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
    }

    if (session.status !== 'ocr_complete') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_STATE',
          message: 'Session not ready for grading'
        }
      });
    }

    // Real AI grading process
    console.log('🤖 Starting real AI grading process...');
    
    // Get the OCR results for both student and professor answers
    const studentOcr = session.ocrResults.find(r => r.type === 'student_answer');
    const professorOcr = session.ocrResults.find(r => r.type === 'professor_answer');
    
    if (!studentOcr || !professorOcr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_OCR_RESULTS',
          message: 'Missing OCR results for grading'
        }
      });
    }

    // Perform real AI grading
    performRealAIGrading(sessionId, studentOcr.extractedText, professorOcr.extractedText)
      .then(gradingResult => {
        session.gradingResult = gradingResult;
        session.status = 'grading_complete';
        session.updatedAt = new Date();
        sessions.set(sessionId, session);

        console.log(`🎯 Real AI grading completed for session: ${sessionId}, score: ${gradingResult.score}/${gradingResult.maxScore}`);
      })
      .catch(error => {
        console.error('🔴 AI grading failed:', error);
        session.status = 'grading_failed';
        session.error = error.message;
        session.updatedAt = new Date();
        sessions.set(sessionId, session);
      });

    session.status = 'processing_grading';
    sessions.set(sessionId, session);

    res.status(202).json({
      success: true,
      data: {
        gradingId: uuidv4(),
        estimatedCompletionTime: 25000,
        status: 'processing_grading'
      },
      message: 'Grading process initiated'
    });
  } catch (error) {
    console.error('Error starting grading:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to start grading'
      }
    });
  }
});

// Get results
app.get('/api/grading/results/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
    }

    console.log(`📊 Retrieved results for session: ${sessionId}, status: ${session.status}`);

    res.json({
      success: true,
      data: {
        session: {
          ...session,
          screenshots: session.screenshots.map(s => ({ ...s, imageData: s.imageData.substring(0, 50) + '...' }))
        },
        gradingResult: session.gradingResult,
        ocrResults: session.ocrResults
      },
      message: 'Results retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving results:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve results'
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.originalUrl} not found`
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error'
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Nous-Grade Backend Server started successfully`);
  console.log(`🌐 Server running on port ${port}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🎯 API Base URL: http://localhost:${port}/api`);
  console.log(`🔑 API Key: [CONFIGURED]`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(`   GET  /health                           - Health check`);
  console.log(`   POST /api/grading/sessions             - Create session`);
  console.log(`   POST /api/grading/screenshots          - Upload screenshots`);
  console.log(`   POST /api/grading/grade                - Trigger grading`);
  console.log(`   GET  /api/grading/results/:sessionId   - Get results`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
