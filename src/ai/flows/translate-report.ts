
'use server';
/**
 * @fileOverview Translates a medical report to a specified language.
 *
 * - translateReport - A function that handles the report translation.
 * - TranslateReportInput - The input type for the translateReport function.
 * - TranslateReportOutput - The return type for the translateReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {GenerateInitialReportOutputSchema} from '@/ai/schemas/report-schema';

const TranslateReportInputSchema = z.object({
  report: GenerateInitialReportOutputSchema.describe('The original report object in English.'),
  language: z.string().describe('The target language for translation (e.g., "es" for Spanish, "hi" for Hindi).'),
});
export type TranslateReportInput = z.infer<typeof TranslateReportInputSchema>;

// We only need a subset of the fields for the output, as confidence scores etc. don't need translation.
const TranslateReportOutputSchema = z.object({
  potentialConditions: z.array(z.object({
    name: z.string().describe('The translated name of the potential skin condition.'),
    description: z.string().describe('The translated brief description of the condition.'),
  })),
  report: z.object({
    primaryDiagnosis: z.string().describe("The translated primary diagnosis."),
    detailedSummary: z.string().describe("The translated 4-5 line detailed summary."),
    keyObservations: z.string().describe("The translated key observations."),
    severityAssessment: z.string().describe("The translated severity assessment.")
  }).describe('The translated structured summary of the analysis and findings.'),
  homeRemedies: z.string().describe('The translated applicable home remedies.'),
  medicalRecommendation: z.string().describe('The translated general medical advice or dermatologist recommendation.'),
});
export type TranslateReportOutput = z.infer<typeof TranslateReportOutputSchema>;

export async function translateReport(input: TranslateReportInput): Promise<TranslateReportOutput> {
  return translateReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateReportPrompt',
  input: {schema: TranslateReportInputSchema},
  output: {schema: TranslateReportOutputSchema},
  prompt: `You are a professional medical translator. Translate the following medical report from English to the target language: {{{language}}}.

  **IMPORTANT:**
  - Translate the medical terms accurately.
  - Do not alter the meaning or tone of the report.
  - Return ONLY the translated text for each field in the specified JSON format.

  **Original Report (English):**
  
  **Potential Conditions:**
  {{#each report.potentialConditions}}
  - Name: {{{this.name}}}
    Description: {{{this.description}}}
  {{/each}}

  **Detailed Analysis:**
  - Primary Diagnosis: {{{report.report.primaryDiagnosis}}}
  - Detailed Summary: {{{report.report.detailedSummary}}}
  - Key Observations: {{{report.report.keyObservations}}}
  - Severity Assessment: {{{report.report.severityAssessment}}}

  **Home Remedies:**
  {{{report.homeRemedies}}}

  **Medical Recommendation:**
  {{{report.medicalRecommendation}}}

  Translate the above into a valid JSON object matching the output schema.
  `,
});

const translateReportFlow = ai.defineFlow(
  {
    name: 'translateReportFlow',
    inputSchema: TranslateReportInputSchema,
    outputSchema: TranslateReportOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
