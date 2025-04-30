"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  DocumentData,
  where,
  getDocs,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Vote as VoteIcon, Trash2, Loader2, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { sortTopicsByRelevance, SortTopicsByRelevanceInput, SortTopicsByRelevanceOutput } from '@/ai/flows/sort-topics-by-relevance'; // Re-use sorting flow
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';


// Schemas
const VotingOptionSchema = z.object({
  text: z.string().min(1, 'Option text cannot be empty'),
});

const NewVotingSchema = z.object({
  name: z.string().min(3, 'Voting name must be at least 3 characters long.'),
  description: z.string().min(5, 'Description must be at least 5 characters long.'),
  options: z.array(VotingOptionSchema).min(2, 'Must have at least two options.'),
});

type VotingTopic = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Timestamp;
  options: { text: string; votes: number; voters: string[] }[]; // Store votes per option and who voted
  creatorEmail?: string; // Optional
  totalVotes?: number; // Optional, calculated dynamically or stored
  userVote?: string; // Optional: store the text of the option the current user voted for
};


export default function VotingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [votings, setVotings] = useState<VotingTopic[]>([]);
  const [sortedVotings, setSortedVotings] = useState<VotingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isVoting, setIsVoting] = useState<string | null>(null); // Store ID of voting being processed
  const [isSorting, setIsSorting] = useState(false);
  const [isNewVotingDialogOpen, setIsNewVotingDialogOpen] = useState(false);


   const newVotingForm = useForm<z.infer<typeof NewVotingSchema>>({
    resolver: zodResolver(NewVotingSchema),
    defaultValues: { name: '', description: '', options: [{ text: '' }, { text: '' }] }, // Start with two options
  });

   const { fields, append, remove } = useFieldArray({
    control: newVotingForm.control,
    name: "options",
  });

    // Fetch User Profile for Relevance Sorting
  const fetchUserProfile = useCallback(async (): Promise<DocumentData | null> => {
    if (!user) return null;
    try {
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      return profileSnap.exists() ? profileSnap.data() : null;
    } catch (error) {
      console.error("Error fetching user profile for relevance:", error);
      return null;
    }
  }, [user]);


  // Fetch and Sort Votings
  useEffect(() => {
    setLoading(true);
    setIsSorting(true);
    const q = query(collection(db, 'votings'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const fetchedVotings: VotingTopic[] = [];
      const userEmails: Record<string, string> = {}; // Cache emails

      // Helper to get email
      const getEmail = async (userId: string) => {
        if (userEmails[userId]) return userEmails[userId];
         try {
           if(userId === user?.uid) return user?.email || 'Unknown User';
           const userDoc = await getDoc(doc(db, 'users', userId)); // Assuming a 'users' collection
           const email = userDoc.exists() ? userDoc.data().email : 'Unknown User';
           userEmails[userId] = email;
           return email;
         } catch (error) {
           console.error("Error fetching user email:", error);
           return 'Unknown User';
         }
      };

      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
         const creatorEmail = await getEmail(data.createdBy);
         const options = Array.isArray(data.options)
            ? data.options.map((opt: any) => ({
                text: opt.text || 'Unnamed Option',
                votes: opt.votes || 0,
                voters: Array.isArray(opt.voters) ? opt.voters : [],
            }))
            : [];
        const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);
        const userVote = options.find(opt => opt.voters.includes(user?.uid || ''))?.text;


        fetchedVotings.push({
          id: docSnapshot.id,
          name: data.name,
          description: data.description,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          creatorEmail: creatorEmail,
          options: options,
          totalVotes: totalVotes,
          userVote: userVote,
        });
      }

      setVotings(fetchedVotings); // Update raw list

      // Sort by relevance using AI
      const userProfile = await fetchUserProfile();
      if (userProfile && fetchedVotings.length > 0) {
         const relevanceInput: SortTopicsByRelevanceInput = {
          topics: fetchedVotings.map(v => ({
            topicId: v.id,
            title: v.name,
            content: v.description, // Use description for relevance content
          })),
           userProfile: userProfile as Record<string, string | number>,
         };

          try {
            const relevanceOutput: SortTopicsByRelevanceOutput = await sortTopicsByRelevance(relevanceInput);
             const topicOrderMap = new Map(relevanceOutput.map((item, index) => [item.topicId, index]));
            const sorted = [...fetchedVotings].sort((a, b) => {
                const orderA = topicOrderMap.get(a.id) ?? Infinity;
                const orderB = topicOrderMap.get(b.id) ?? Infinity;
                return orderA - orderB;
            });
            setSortedVotings(sorted);
          } catch (error) {
             console.error("Error sorting votings by relevance:", error);
             toast({ variant: "destructive", title: "AI Sort Error", description: "Could not sort votings by relevance." });
             setSortedVotings(fetchedVotings); // Fallback
          }

      } else {
           setSortedVotings(fetchedVotings); // Fallback if no profile or votings
      }


      setLoading(false);
      setIsSorting(false);
    }, (error) => {
      console.error("Error fetching votings: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load votings." });
      setLoading(false);
      setIsSorting(false);
    });

    return () => unsubscribe();
  }, [user, toast, fetchUserProfile]);


  // Handlers
  const handleCreateVoting = async (values: z.infer<typeof NewVotingSchema>) => {
    if (!user) return;
    setIsCreating(true);
    try {
      const formattedOptions = values.options.map(opt => ({
          text: opt.text,
          votes: 0,
          voters: [], // Initialize voters array
      }));

      await addDoc(collection(db, 'votings'), {
        name: values.name,
        description: values.description,
        options: formattedOptions,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });
      toast({ title: 'Voting Created', description: `"${values.name}" has been successfully created.` });
      newVotingForm.reset();
      setIsNewVotingDialogOpen(false); // Close dialog
    } catch (error) {
      console.error('Error creating voting:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create voting.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleVote = async (votingId: string, selectedOptionText: string) => {
    if (!user || isVoting === votingId) return; // Prevent double voting while processing
    setIsVoting(votingId); // Mark this voting as being processed

    const votingRef = doc(db, 'votings', votingId);

    try {
        const votingSnap = await getDoc(votingRef);
        if (!votingSnap.exists()) {
            throw new Error("Voting not found");
        }
        const votingData = votingSnap.data() as VotingTopic; // Assuming type, adjust as needed

        // --- Calculate Voting Weight (Placeholder) ---
        // This is where you'd implement the logic based on relevance and skillset.
        // For now, let's assume a weight of 1 for simplicity.
        const votingWeight = 1;
        // --- End Placeholder ---


        const currentOptions = votingData.options || [];
        const userPreviousVoteOption = currentOptions.find(opt => opt.voters.includes(user.uid));

        // Check if user is changing their vote or voting for the first time
        if (userPreviousVoteOption && userPreviousVoteOption.text === selectedOptionText) {
            // User clicked the same option again - potentially unvote (optional feature)
             console.log("User clicked the same option.");
             setIsVoting(null); // Reset processing state
             return; // Or implement unvoting logic here
        }

        const updatedOptions = currentOptions.map(option => {
            let newVotes = option.votes;
            let newVoters = [...option.voters];

            // Remove user from previous vote if they are changing vote
            if (userPreviousVoteOption && option.text === userPreviousVoteOption.text) {
                newVotes = Math.max(0, newVotes - votingWeight); // Decrement previous vote
                newVoters = newVoters.filter(voterId => voterId !== user.uid);
            }

            // Add user to the new vote
            if (option.text === selectedOptionText) {
                newVotes += votingWeight; // Increment new vote
                newVoters.push(user.uid);
            }

            return { ...option, votes: newVotes, voters: newVoters };
        });


        await updateDoc(votingRef, { options: updatedOptions });

        toast({ title: 'Vote Cast', description: `Your vote for "${selectedOptionText}" has been recorded.` });

    } catch (error) {
        console.error('Error casting vote:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not cast vote.' });
    } finally {
       setIsVoting(null); // Reset processing state regardless of success/failure
    }
};


  return (
    <div className="container mx-auto py-8 px-4 md:px-0 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <VoteIcon className="h-7 w-7" /> Votings
        </h1>
         <Dialog open={isNewVotingDialogOpen} onOpenChange={setIsNewVotingDialogOpen}>
           <DialogTrigger asChild>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Voting
             </Button>
           </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                 <DialogHeader>
                    <DialogTitle>Create a New Voting</DialogTitle>
                 </DialogHeader>
                <Form {...newVotingForm}>
                    <form onSubmit={newVotingForm.handleSubmit(handleCreateVoting)} className="space-y-4">
                    <FormField
                        control={newVotingForm.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Voting Title</FormLabel>
                            <FormControl><Input placeholder="e.g., Best Study Location" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={newVotingForm.control}
                        name="description"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl><Textarea placeholder="Describe the voting topic..." {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                     <div className="space-y-3">
                        <FormLabel>Options</FormLabel>
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                            <FormField
                                control={newVotingForm.control}
                                name={`options.${index}.text`}
                                render={({ field: optionField }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                        <Input placeholder={`Option ${index + 1}`} {...optionField} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             {fields.length > 2 && ( // Only allow removing if more than 2 options
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => remove(index)}
                                    className="text-destructive hover:bg-destructive/10"
                                    aria-label={`Remove option ${index + 1}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                             )}
                            </div>
                        ))}
                         <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ text: '' })}
                            className="border-dashed border-accent text-accent hover:bg-accent/10 hover:text-accent"
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                         </Button>
                          {newVotingForm.formState.errors.options?.root && ( // Display root error for min length
                            <p className="text-sm font-medium text-destructive">
                                {newVotingForm.formState.errors.options.root.message}
                            </p>
                         )}
                    </div>


                    <DialogFooter>
                        <DialogClose asChild>
                             <Button type="button" variant="outline">Cancel</Button>
                         </DialogClose>
                        <Button type="submit" disabled={isCreating}>
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Voting
                        </Button>
                    </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
         </Dialog>
      </div>

       {loading || isSorting ? (
         <div className="space-y-4">
           <Skeleton className="h-32 w-full" />
           <Skeleton className="h-32 w-full" />
           <Skeleton className="h-32 w-full" />
         </div>
       ) : sortedVotings.length === 0 ? (
          <Card className="text-center py-12">
             <CardContent>
                 <p className="text-muted-foreground">No votings found. Be the first to create one!</p>
            </CardContent>
          </Card>
       ) : (
          <ScrollArea className="flex-1 pr-4 -mr-4"> {/* Add ScrollArea */}
             <div className="space-y-4">
             {sortedVotings.map((voting) => (
                 <Card key={voting.id}>
                 <CardHeader>
                     <CardTitle>{voting.name}</CardTitle>
                     <CardDescription>
                         {voting.description}
                         <br />
                         <span className="text-xs text-muted-foreground">
                             Created by {voting.creatorEmail || 'Unknown User'} - {formatDistanceToNow(voting.createdAt.toDate(), { addSuffix: true })}
                         </span>
                     </CardDescription>
                 </CardHeader>
                 <CardContent>
                     <RadioGroup
                        value={voting.userVote} // Set the currently selected vote
                        onValueChange={(value) => handleVote(voting.id, value)}
                        disabled={isVoting === voting.id} // Disable while voting on this specific item
                        className="space-y-3"
                    >
                        {voting.options.map((option, index) => {
                            const percentage = voting.totalVotes && voting.totalVotes > 0
                                ? Math.round((option.votes / voting.totalVotes) * 100)
                                : 0;
                             return (
                                <Label
                                    key={index}
                                    htmlFor={`${voting.id}-option-${index}`}
                                    className={`flex flex-col p-3 border rounded-md hover:bg-accent/10 cursor-pointer ${voting.userVote === option.text ? 'border-primary bg-accent/5' : ''} ${isVoting === voting.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                     <div className="flex items-center justify-between mb-2">
                                         <div className="flex items-center gap-2">
                                            <RadioGroupItem
                                                value={option.text}
                                                id={`${voting.id}-option-${index}`}
                                                disabled={isVoting === voting.id}
                                                aria-label={option.text}
                                            />
                                            <span className="font-medium">{option.text}</span>
                                         </div>
                                         <span className="text-sm text-muted-foreground">{option.votes} vote(s)</span>
                                     </div>
                                      <Progress value={percentage} className="h-2" />
                                      <span className="text-xs text-muted-foreground text-right mt-1">{percentage}%</span>
                                </Label>
                             );
                         })}
                     </RadioGroup>
                      {isVoting === voting.id && <Loader2 className="h-4 w-4 animate-spin text-primary mt-2 mx-auto" />}
                 </CardContent>
                 </Card>
             ))}
             </div>
          </ScrollArea>
       )}
    </div>
  );
}
