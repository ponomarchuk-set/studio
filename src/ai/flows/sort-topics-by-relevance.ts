// src/ai/flows/sort-topics-by-relevance.ts
'use server';
/**
 * @fileOverview Sorts topics (Chat, Voting) by relevance to a user's profile.
 *
 * - sortTopicsByRelevance - A function that sorts topics based on user profile data.
 * - SortTopicsByRelevanceInput - The input type for the sortTopicsByRelevance function.
 * - SortTopicsByRelevanceOutput - The return type for the sortTopicsByRelevance function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ProfileDataSchema = z.record(z.string(), z.string().or(z.number()));

const SortTopicsByRelevanceInputSchema = z.object({
  topics: z.array(
    z.object({
      topicId: z.string().describe('The ID of the topic.'),
      title: z.string().describe('The title of the topic.'),
      content: z.string().describe('The content of the topic.'),
    })
  ).describe('An array of topics to be sorted.'),
  userProfile: ProfileDataSchema.describe('The user profile data.'),
});

export type SortTopicsByRelevanceInput = z.infer<typeof SortTopicsByRelevanceInputSchema>;

const SortTopicsByRelevanceOutputSchema = z.array(
  z.object({
    topicId: z.string().describe('The ID of the topic.'),
    relevanceScore: z.number().describe('The relevance score of the topic for the user.'),
  })
).describe('An array of topics with their relevance scores, sorted by relevance.');

export type SortTopicsByRelevanceOutput = z.infer<typeof SortTopicsByRelevanceOutputSchema>;

export async function sortTopicsByRelevance(input: SortTopicsByRelevanceInput): Promise<SortTopicsByRelevanceOutput> {
  return sortTopicsByRelevanceFlow(input);
}

const sortTopicsPrompt = ai.definePrompt({
  name: 'sortTopicsPrompt',
  input: {
    schema: z.object({
      topics: z.array(
        z.object({
          topicId: z.string().describe('The ID of the topic.'),
          title: z.string().describe('The title of the topic.'),
          content: z.string().describe('The content of the topic.'),
        })
      ).describe('An array of topics to be sorted.'),
      userProfile: z.record(z.string(), z.string().or(z.number())).describe('The user profile data.'),
    }),
  },
  output: {
    schema: z.array(
      z.object({
        topicId: z.string().describe('The ID of the topic.'),
        relevanceScore: z.number().describe('The relevance score of the topic for the user.'),
      })
    ).describe('An array of topics with their relevance scores, sorted by relevance.'),
  },
  prompt: `You are an AI expert in determining the relevance of topics to a user based on their profile data.

  Given the following topics and user profile, determine a relevance score (0-100) for each topic, representing how relevant the topic is to the user.

  User Profile:
  {{#each (each userProfile)}}
  {{@key}}: {{this}}
  {{/each}}

  Topics:
  {{#each topics}}
  Topic ID: {{topicId}}
  Title: {{title}}
  Content: {{content}}
  ---
  {{/each}}

  Return a JSON array of topic IDs and their corresponding relevance scores, sorted by relevance score in descending order.
  Ensure the output is a valid JSON array.
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
  const {output} = await sortTopicsPrompt(input);

  // Attempt to parse the output as JSON.
  try {
    const parsedOutput = JSON.parse(output as any);

    // Validate the parsed output against the schema.
    const validationResult = z.array(
      z.object({
        topicId: z.string(),
        relevanceScore: z.number(),
      })
    ).safeParse(parsedOutput);

    if (validationResult.success) {
      // Sort the topics by relevance score in descending order.
      const sortedTopics = validationResult.data.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return sortedTopics as SortTopicsByRelevanceOutput;
    } else {
      console.error('Output validation failed:', validationResult.error);
      // If validation fails, return a default or error response.
      return [];
    }
  } catch (e) {
    console.error('Failed to parse JSON from the model output.', e);
    return [];
  }
});


