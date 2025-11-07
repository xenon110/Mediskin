
'use server';

/**
 * @fileOverview Generates an initial medical report based on a skin image and symptom inputs.
 *
 * - generateInitialReport - A function that generates the report.
 * - GenerateInitialReportInput - The input type for the generateInitialReport function.
 * - GenerateInitialReportOutput - The return type for the generateInitialReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { GenerateInitialReportOutputSchema } from '@/ai/schemas/report-schema';


const GenerateInitialReportInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the skin condition, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  symptomInputs: z.string().describe('Additional symptoms described by the patient.'),
  region: z.string().describe('The region of the patient.'),
  skinTone: z.string().describe('The skin tone of the patient.'),
  age: z.number().describe('The age of the patient.'),
  gender: z.string().describe('The gender of the patient.'),
});
export type GenerateInitialReportInput = z.infer<typeof GenerateInitialReportInputSchema>;

export type GenerateInitialReportOutput = z.infer<typeof GenerateInitialReportOutputSchema>;

export async function generateInitialReport(
  input: GenerateInitialReportInput
): Promise<GenerateInitialReportOutput> {
  return generateInitialReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInitialReportPrompt',
  input: {schema: GenerateInitialReportInputSchema},
  output: {schema: GenerateInitialReportOutputSchema},
  prompt: `You are a world-class AI medical assistant specializing in dermatology, with access to a vast knowledge base of medical literature and case studies. Your primary task is to provide a highly accurate analysis of a patient's skin condition based on an image and supplementary information.

  **CRITICAL INSTRUCTIONS:**
  1.  **Prioritize Visual Evidence:** Your analysis MUST be primarily driven by the visual information in the provided image. The patient's described symptoms are secondary and should be used to refine the diagnosis, but the visual characteristics of the skin condition are the most critical factor.
  2.  **Differential Diagnosis:** Identify a list of potential skin conditions that match the visual evidence.
  3.  **Be Critical and Cautious:** For each potential condition, you must provide:
      - 'name': The medical name of the condition.
      - 'likelihood': Your assessment of how likely this condition is (High, Medium, or Low).
      - 'confidence': A numerical confidence score between 0.0 and 1.0 representing your certainty in this potential diagnosis based on the provided evidence. A score of 1.0 means you are highly confident.
      - 'description': A concise medical description of the condition.
  4.  **Structured Report:** You must generate a 'report' object containing a structured summary of your analytical process. This object must have three fields:
      - 'primaryDiagnosis': Start with the features observed and state the most likely diagnosis.
      - 'keyObservations': Describe the specific visual details (e.g., color, shape, texture) that support your diagnosis. **This must be formatted as a bulleted or numbered list within the string.**
      - 'severityAssessment': Provide a visual analysis of the severity and state whether medical attention is warranted.
  5.  **Actionable Recommendations:** You must provide safe, relevant 'homeRemedies' and a clear 'medicalRecommendation'.
  6.  **Consultation Flag:** Set 'doctorConsultationSuggestion' to true if there is any uncertainty or if the condition appears serious.
  7.  **Disclaimer:** Frame your response as an AI assistant. Always emphasize that this is not a substitute for professional medical advice and a consultation with a qualified dermatologist is essential for an accurate diagnosis.

  **Patient Information:**
  - Age: {{{age}}}
  - Gender: {{{gender}}}
  - Region: {{{region}}}
  - Skin Tone: {{{skinTone}}}
  - Described Symptoms: {{{symptomInputs}}}

  **Analyze this image:**
  {{media url=photoDataUri}}

  You must provide a structured JSON output.
  `,
});

const generateInitialReportFlow = ai.defineFlow(
  {
    name: 'generateInitialReportFlow',
    inputSchema: GenerateInitialReportInputSchema,
    outputSchema: GenerateInitialReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
