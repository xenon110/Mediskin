
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
  prompt: `You are an AI medical assistant specializing in dermatology. Analyze the provided image and symptoms to generate a preliminary medical report.

  **Patient Information:**
  - Age: {{{age}}}
  - Gender: {{{gender}}}
  - Region: {{{region}}}
  - Skin Tone: {{{skinTone}}}
  - Described Symptoms: {{{symptomInputs}}}

  **Analyze this image:**
  {{media url=photoDataUri}}

  **Instructions:**
  1.  **Identify Potential Conditions:** Based on the image and symptoms, list potential skin conditions. For each, provide a 'name', 'likelihood' (High, Medium, or Low), a 'confidence' score (0.0 to 1.0), and a brief 'description'.
  2.  **Generate a Report:** Summarize your findings in a single 'report' string. This should be a comprehensive but easy-to-understand analysis.
  3.  **Provide Recommendations:** Suggest relevant 'homeRemedies' and a general 'medicalRecommendation'.
  4.  **Consultation Flag:** Set 'doctorConsultationSuggestion' to true if the condition appears serious or if there's any uncertainty.
  5.  **Disclaimer:** Always remind the user that this is an AI analysis and not a substitute for professional medical advice.

  Provide a structured JSON output.
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
