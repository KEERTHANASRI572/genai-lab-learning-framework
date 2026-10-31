import mongoose from 'mongoose';
import crypto from 'crypto';
import { LearningResource } from '../models/LearningResource';
import { ResourceChunk, IResourceChunk } from '../models/ResourceChunk';
import { IAssessmentQuestion, QuestionDifficulty } from '../models/Assessment';

export interface GenerateQuestionsOptions {
  resourceId: string;
  institutionId: string;
  experimentId: string;
  facultyUserId: string;
  count?: number;
  difficulty?: 'all' | 'beginner' | 'intermediate' | 'advanced';
  topicFocus?: string;
}

interface TechnicalFact {
  topic: string;
  questionPrompt: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  difficulty: QuestionDifficulty;
  passage: string;
}

/**
 * Extracts grounded factual statements from text passages to synthesize valid,
 * strictly-grounded assessment questions.
 */
function extractGroundedFactsFromChunks(
  chunks: IResourceChunk[],
  targetCount: number,
  difficultyFilter?: string,
  topicFocus?: string
): TechnicalFact[] {
  const facts: TechnicalFact[] = [];
  const focusRegex = topicFocus ? new RegExp(topicFocus.trim(), 'i') : null;

  for (const chunk of chunks) {
    if (facts.length >= targetCount * 2) break;
    const text = chunk.text.trim();
    if (text.length < 50) continue;

    // Filter by topic focus if specified
    if (focusRegex && !focusRegex.test(text)) continue;

    // Split passage into technical sentences
    const sentences = text
      .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 35 && s.length <= 350);

    for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
      const sentence = sentences[sIdx]!;

      // 1. Formula & Relationship patterns (e.g. tau = R * C, V = I * R, f = 1 / (2*pi*sqrt(L*C)))
      const formulaMatch = sentence.match(/([a-zA-Z\u0370-\u03ff\s]+)\s*(=|is defined as|is given by|equals|is proportional to)\s*([^.]{3,60})/i);
      if (formulaMatch && formulaMatch[1] && formulaMatch[3]) {
        const concept = formulaMatch[1].trim();
        const formula = formulaMatch[3].trim();
        if (concept.length >= 3 && concept.length <= 40 && formula.length >= 2) {
          facts.push({
            topic: concept.length > 25 ? concept.substring(0, 25) : concept,
            questionPrompt: `According to the laboratory documentation, what expression defines ${concept}?`,
            correctAnswer: formula,
            distractors: [
              formula.replace(/\*/g, '/').replace(/\+/g, '-'),
              `1 / (${formula})`,
              `2 * (${formula})`,
            ].filter((d) => d !== formula),
            explanation: `Document reference: "${sentence}"`,
            difficulty: 'intermediate',
            passage: sentence,
          });
          continue;
        }
      }

      // 2. Percentage / Measurement & Specification patterns (e.g. 63.2%, 5V, 10k, 100uF)
      const numericMatch = sentence.match(/([A-Z][a-zA-Z\s]{4,35})\s+(?:reaches|is|equals|measured at|specified as|maintained at|within)\s+([0-9.]+(?:\s*(?:%|V|mA|A|kHz|Hz|ms|s|kΩ|Ω|uF|mH|H|dB))?)/i);
      if (numericMatch && numericMatch[1] && numericMatch[2]) {
        const parameter = numericMatch[1].trim();
        const value = numericMatch[2].trim();
        if (value.length >= 1 && value.length <= 15) {
          facts.push({
            topic: parameter.length > 25 ? parameter.substring(0, 25) : parameter,
            questionPrompt: `What is the documented value or specification for ${parameter}?`,
            correctAnswer: value,
            distractors: [
              `${(parseFloat(value) * 0.5 || 25).toFixed(1)}${value.replace(/[0-9.]/g, '')}`,
              `${(parseFloat(value) * 1.5 || 75).toFixed(1)}${value.replace(/[0-9.]/g, '')}`,
              `${(parseFloat(value) * 2.0 || 100).toFixed(1)}${value.replace(/[0-9.]/g, '')}`,
            ].filter((d) => d !== value),
            explanation: `Grounded in curriculum manual: "${sentence}"`,
            difficulty: 'beginner',
            passage: sentence,
          });
          continue;
        }
      }

      // 3. Safety, Caution & Procedural Protocol patterns
      const safetyMatch = sentence.match(/(?:ensure|verify|must|caution|warning|important|do not|always)\s+([^.]{15,180})/i);
      if (safetyMatch && safetyMatch[1]) {
        const rule = safetyMatch[1].trim();
        facts.push({
          topic: 'Laboratory Protocol & Safety',
          questionPrompt: `In this procedure, what critical condition or safety protocol must be observed regarding ${rule.substring(0, 45)}...?`,
          correctAnswer: `Ensure ${rule}`,
          distractors: [
            `Bypass ${rule.substring(0, 30)} during initial calibration sweeps`,
            `Perform ${rule.substring(0, 30)} only after full power disconnect`,
            `Reverse the specified connection sequence if current exceeds baseline`,
          ],
          explanation: `Protocol excerpt: "${sentence}"`,
          difficulty: 'advanced',
          passage: sentence,
        });
        continue;
      }

      // 4. Component / Apparatus Function pattern
      const functionMatch = sentence.match(/(?:The\s+)?([A-Z][a-zA-Z\s]{3,30})\s+(?:is used to|serves as|functions to|operates by|enables)\s+([^.]{10,120})/i);
      if (functionMatch && functionMatch[1] && functionMatch[2]) {
        const apparatus = functionMatch[1].trim();
        const role = functionMatch[2].trim();
        facts.push({
          topic: apparatus.length > 25 ? apparatus.substring(0, 25) : apparatus,
          questionPrompt: `What is the primary function of ${apparatus} in this laboratory configuration?`,
          correctAnswer: `To ${role}`,
          distractors: [
            `To compensate for parasitic impedance in adjacent measurement channels`,
            `To provide external clock synchronization across passive components`,
            `To record secondary harmonics during transient power surges`,
          ],
          explanation: `Document manual state: "${sentence}"`,
          difficulty: 'beginner',
          passage: sentence,
        });
      }
    }
  }

  // Filter by difficulty if requested
  let filtered = facts;
  if (difficultyFilter && difficultyFilter !== 'all') {
    filtered = facts.filter((f) => f.difficulty === difficultyFilter);
    if (filtered.length < targetCount) {
      filtered = facts; // Fall back to all if difficulty pool is small
    }
  }

  return filtered;
}

/**
 * Generates grounded, draft assessment questions from an indexed LearningResource.
 */
export async function generateAssessmentQuestionsFromResource(
  options: GenerateQuestionsOptions
): Promise<{
  questions: IAssessmentQuestion[];
  resource: { _id: string; title: string; chunkCount: number };
}> {
  const { resourceId, institutionId, facultyUserId, count = 5, difficulty = 'all', topicFocus } = options;

  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new Error('Invalid resource ID format.');
  }

  const resource = await LearningResource.findOne({
    _id: resourceId,
    institutionId,
  });

  if (!resource) {
    throw new Error('Target document not found in your institution.');
  }

  if (resource.ragIndexingStatus !== 'ready') {
    const errorDetails = resource.processingFailureReason
      ? ` Error: ${resource.processingFailureReason}`
      : '';
    throw new Error(
      `Cannot generate questions. Document indexing status is "${resource.ragIndexingStatus}".${errorDetails} Please ensure vector indexing completes successfully first.`
    );
  }

  // Retrieve indexed chunks
  const chunks = await ResourceChunk.find({
    resourceId: resource._id,
    institutionId,
  })
    .sort({ chunkIndex: 1 })
    .lean();

  if (chunks.length === 0) {
    throw new Error('No indexed content chunks found for this document. Please re-index the document.');
  }

  // Extract grounded technical facts strictly from the document chunks
  const facts = extractGroundedFactsFromChunks(chunks as unknown as IResourceChunk[], count, difficulty, topicFocus);

  if (facts.length === 0) {
    // If strict regex patterns didn't match enough sentences, use passage-level synthesis
    for (let i = 0; i < Math.min(chunks.length, count); i++) {
      const chunk = chunks[i]!;
      const cleanSnippet = chunk.text.trim().substring(0, 160);
      facts.push({
        topic: resource.title.substring(0, 30),
        questionPrompt: `Based on Section ${chunk.chunkIndex + 1} of "${resource.title}", which statement correctly represents the procedural guidelines?`,
        correctAnswer: cleanSnippet.endsWith('.') ? cleanSnippet : `${cleanSnippet}...`,
        distractors: [
          'The parameter tolerances are unconstrained and need not be recorded.',
          'Initial diagnostic measurements should be deferred until final circuit teardown.',
          'Safety ground isolations are optional for low-voltage signal sweeps.',
        ],
        explanation: `Curriculum reference from chunk ${chunk.chunkIndex + 1}: "${chunk.text.substring(0, 200)}..."`,
        difficulty: (chunk.chunkIndex % 3 === 0 ? 'beginner' : chunk.chunkIndex % 3 === 1 ? 'intermediate' : 'advanced') as QuestionDifficulty,
        passage: chunk.text.substring(0, 300),
      });
    }
  }

  // Map extracted facts into IAssessmentQuestion shape with DRAFT status
  const selectedFacts = facts.slice(0, count);
  const questions: IAssessmentQuestion[] = selectedFacts.map((fact, idx) => {
    const qId = `rag-${Date.now()}-${idx}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Ensure 4 distinct options with randomized correct position
    const optionsList = [
      { optionId: 'opt-1', text: fact.correctAnswer },
      { optionId: 'opt-2', text: fact.distractors[0] || 'Alternative configuration not recommended.' },
      { optionId: 'opt-3', text: fact.distractors[1] || 'Secondary parameter exceeds standard tolerance.' },
      { optionId: 'opt-4', text: fact.distractors[2] || 'Theoretical extrapolation without experimental verification.' },
    ];

    // Shuffle options so opt-1 is not always correct
    const shuffled = [...optionsList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    return {
      questionId: qId,
      topicTag: fact.topic,
      prompt: fact.questionPrompt,
      options: shuffled.map((o, optIdx) => ({
        optionId: `opt-${optIdx + 1}`,
        text: o.text,
      })),
      correctOptionId: `opt-${shuffled.findIndex((o) => o.text === fact.correctAnswer) + 1}`,
      explanation: fact.explanation,
      difficulty: fact.difficulty,
      weight: 10,
      sourceType: 'ai_generated',
      status: 'draft', // MUST BE DRAFT (Requirement 5)
      sourceDocumentId: resource._id,
      sourceDocumentTitle: resource.title,
      sourceChunkIndex: idx,
      sourcePassage: fact.passage,
      authorFacultyUserId: new mongoose.Types.ObjectId(facultyUserId),
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  return {
    questions,
    resource: {
      _id: resource._id.toString(),
      title: resource.title,
      chunkCount: chunks.length,
    },
  };
}
