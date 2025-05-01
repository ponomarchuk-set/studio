
// src/ai/flows/sort-topics-by-relevance.ts
'use server';
/**
 * @fileOverview Sorts topics (Chat, Voting, Tasks) by relevance to a user's profile.
 *
 * - sortTopicsByRelevance - A function that sorts topics based on user profile data.
 * - SortTopicsByRelevanceInput - The input type for the sortTopicsByRelevance function.
 * - SortTopicsByRelevanceOutput - The return type for the sortTopicsByRelevance function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Expect a flat record of strings and numbers for the user profile
const FlatProfileDataSchema = z.record(z.string(), z.string().or(z.number()))
    .describe('A flat key-value representation of the user profile data.');


const SortTopicsByRelevanceInputSchema = z.object({
  topics: z.array(
    z.object({
      topicId: z.string().describe('The ID of the topic.'),
      title: z.string().describe('The title of the topic.'),
      content: z.string().describe('The content of the topic.'),
    })
  ).describe('An array of topics to be sorted.'),
  userProfile: FlatProfileDataSchema, // Use the flat schema
});

export type SortTopicsByRelevanceInput = z.infer<typeof SortTopicsByRelevanceInputSchema>;

const SortTopicsByRelevanceOutputSchema = z.array(
  z.object({
    topicId: z.string().describe('The ID of the topic.'),
    relevanceScore: z.number().min(0).max(100).describe('The relevance score (0-100) of the topic for the user.'), // Added min/max validation
  })
).describe('An array of topics with their relevance scores, sorted by relevance score in descending order.');

export type SortTopicsByRelevanceOutput = z.infer<typeof SortTopicsByRelevanceOutputSchema>;

export async function sortTopicsByRelevance(input: SortTopicsByRelevanceInput): Promise<SortTopicsByRelevanceOutput> {
  // Validate input before calling the flow (optional but good practice)
  const validation = SortTopicsByRelevanceInputSchema.safeParse(input);
  if (!validation.success) {
    console.error("Invalid input to sortTopicsByRelevance:", validation.error);
    // Handle error appropriately, e.g., return empty array or throw
    return [];
  }
  return sortTopicsByRelevanceFlow(input);
}

const sortTopicsPrompt = ai.definePrompt({
  name: 'sortTopicsPrompt',
  input: {
    schema: SortTopicsByRelevanceInputSchema, // Use the updated input schema
  },
  output: {
    schema: SortTopicsByRelevanceOutputSchema, // Use the updated output schema
  },
  prompt: `You are an AI expert in determining the relevance of various topics (like chat discussions, tasks, or voting items) to a user based on their profile data.

  Analyze the provided user profile information and the list of topics. For each topic, assign a relevance score between 0 (not relevant at all) and 100 (highly relevant).

  User Profile (Key-Value Pairs):
  {{#each userProfile}}
  {{@key}}: {{this}}
  {{/each}}

  Topics to Score:
  {{#each topics}}
  ---
  Topic ID: {{topicId}}
  Title: {{title}}
  Content/Description: {{content}}
  {{/each}}
  ---

  Based on your analysis, return a JSON array containing objects for each topic. Each object must include the 'topicId' and its calculated 'relevanceScore'. The array should be sorted by 'relevanceScore' in descending order (most relevant first).

  Ensure the output is ONLY the valid JSON array, adhering strictly to the required output format. Do not include any introductory text, explanations, or markdown formatting around the JSON.
  `,
});


const sortTopicsByRelevanceFlow = ai.defineFlow<
  typeof SortTopicsByRelevanceInputSchema,
  typeof SortTopicsByRelevanceOutputSchema
>({
  name: 'sortTopicsByRelevanceFlow',
  inputSchema: SortTopicsByRelevanceInputSchema,
  outputSchema: SortTopicsByRelevanceOutputSchema,
},
async input => {
    console.log("Input to sortTopicsByRelevanceFlow:", JSON.stringify(input, null, 2)); // Log input

    const {output, history} = await sortTopicsPrompt.generate({input}); // Use generate for more control

    console.log("Raw output from sortTopicsPrompt:", output); // Log raw output
    // console.log("History:", JSON.stringify(history, null, 2)); // Log history if needed


  // Attempt to parse the output, assuming it's already a valid JSON object/array
  // as requested by the prompt and defined by the output schema.
  const parsedOutput = output; // No JSON.parse needed if output schema is respected

  // Validate the parsed output against the schema.
  const validationResult = SortTopicsByRelevanceOutputSchema.safeParse(parsedOutput);

  if (validationResult.success) {
    // Sort the topics by relevance score in descending order (already requested in prompt, but good to ensure).
    const sortedTopics = validationResult.data.sort((a, b) => b.relevanceScore - a.relevanceScore);
    console.log("Successfully parsed and validated output:", sortedTopics);
    return sortedTopics; // Return the validated and sorted data
  } else {
    console.error('Output validation failed:', validationResult.error.errors);
    console.error('Received output:', parsedOutput);
    // Try to recover if possible, or return a default/error state.
    // If the output was a string that looked like JSON, try parsing it.
    if (typeof parsedOutput === 'string') {
        try {
            const jsonParsed = JSON.parse(parsedOutput);
            const reValidationResult = SortTopicsByRelevanceOutputSchema.safeParse(jsonParsed);
            if (reValidationResult.success) {
                 const sortedTopics = reValidationResult.data.sort((a, b) => b.relevanceScore - a.relevanceScore);
                 console.warn("Output was string but successfully parsed and validated after JSON.parse:", sortedTopics);
                 return sortedTopics;
            } else {
                 console.error('Re-validation after JSON.parse failed:', reValidationResult.error.errors);
            }
        } catch (parseError) {
            console.error('Failed to parse string output as JSON:', parseError);
        }
    }

    // Fallback: Return empty array or throw an error
    toast({ // Use toast for user feedback if applicable
        variant: "destructive",
        title: "AI Sorting Error",
        description: "The AI failed to return relevance scores in the expected format. Using default order.",
    });
    return [];
  }
});

// Helper function for toast (replace with your actual toast implementation)
const toast = (options: {variant?: string, title: string, description: string}) => {
    console.error(`Toast: ${options.title} - ${options.description}`);
};


