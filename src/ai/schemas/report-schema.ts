
import {z} from 'genkit';

/**
 * @fileOverview Defines the Zod schema for the AI-generated report output.
 * This schema is used by both the report generation and translation flows.
 */

export const GenerateInitialReportOutputSchema = z.object({
  potentialConditions: z.array(z.object({
    name: z.string().describe('The name of the potential skin condition.'),
    likelihood: z.enum(['High', 'Medium', 'Low']).describe('The likelihood of this condition.'),
    confidence: z.number().min(0).max(1).describe('The confidence score from 0.0 to 1.0.'),
    description: z.string().describe('A brief description of the condition.'),
  })).describe('An array of potential skin conditions identified from the image and symptoms.'),
  report: z.string().describe("A detailed analysis of the condition, including what it is, key observations, and severity."),
  homeRemedies: z.string().describe('Applicable home remedies, if any.'),
  medicalRecommendation: z.string().describe('General medical advice or dermatologist recommendation.'),
  doctorConsultationSuggestion: z.boolean().describe('Whether a doctor consultation is suggested.'),
});
