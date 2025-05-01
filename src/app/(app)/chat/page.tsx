
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
  where,
  getDocs,
  DocumentData,
  limit,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MessageSquare, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sortTopicsByRelevance, SortTopicsByRelevanceInput, SortTopicsByRelevanceOutput } from '@/ai/flows/sort-topics-by-relevance';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ProfileFormData } from '../profile/page'; // Import ProfileFormData type


// Schemas
const NewTopicSchema = z.object({
  name: z.string().min(3, 'Topic name must be at least 3 characters long.'),
  text: z.string().min(5, 'Initial message must be at least 5 characters long.'),
});

const NewMessageSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty.'),
});

type Topic = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
  creatorEmail?: string; // Optional: Store email for display
  firstMessage: string; // Store first message content for relevance sorting
};

type Message = {
  id: string;
  text: string;
  userId: string;
  createdAt: Timestamp;
  userEmail?: string; // Optional: Store email for display
};

// Function to flatten the profile data
const flattenProfileData = (profile: ProfileFormData | null): Record<string, string | number> => {
    if (!profile) return {};
    const flatProfile: Record<string, string | number> = {};
    Object.entries(profile).forEach(([sectionKey, sectionValue]) => {
      if (Array.isArray(sectionValue)) {
        sectionValue.forEach((item: { key: string; value: string }) => {
          // Handle potential key collisions if necessary, e.g., prefixing
          // For now, simple assignment (last one wins if keys collide across sections)
          if (item.key && item.value) {
            flatProfile[`${sectionKey}_${item.key.replace(/\s+/g, '_')}`] = item.value;
          }
        });
      }
    });
    return flatProfile;
};


export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sortedTopics, setSortedTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [isNewTopicDialogOpen, setIsNewTopicDialogOpen] = useState(false);

  const newTopicForm = useForm<z.infer<typeof NewTopicSchema>>({
    resolver: zodResolver(NewTopicSchema),
    defaultValues: { name: '', text: '' },
  });

  const newMessageForm = useForm<z.infer<typeof NewMessageSchema>>({
    resolver: zodResolver(NewMessageSchema),
    defaultValues: { text: '' },
  });

  // Fetch User Profile for Relevance Sorting
  const fetchUserProfile = useCallback(async (): Promise<ProfileFormData | null> => {
    if (!user) return null;
    try {
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      return profileSnap.exists() ? profileSnap.data() as ProfileFormData : null; // Cast to ProfileFormData
    } catch (error) {
      console.error("Error fetching user profile for relevance:", error);
      return null;
    }
  }, [user]);

  // Fetch and Sort Topics
  useEffect(() => {
    setLoadingTopics(true);
    setIsSorting(true);
    const q = query(collection(db, 'chatTopics'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const fetchedTopics: Topic[] = [];
      const userEmails: Record<string, string> = {}; // Cache emails

      // Helper to get email (basic caching)
      const getEmail = async (userId: string) => {
        if (userEmails[userId]) return userEmails[userId];
        try {
           // In a real app, fetch user display name/email from a 'users' collection
           // For now, we'll just use a placeholder or potentially the logged-in user's email if it matches
           if(userId === user?.uid) return user?.email || 'Unknown User';
           // Basic fetch attempt (might need security rules adjustment)
           const userDoc = await getDoc(doc(db, 'users', userId)); // Assuming a 'users' collection
           const email = userDoc.exists() && userDoc.data()?.email ? userDoc.data().email : 'Unknown User';
           userEmails[userId] = email;
           return email;
        } catch (error) {
          console.error("Error fetching user email:", error);
          return 'Unknown User';
        }
      };


      for (const doc of querySnapshot.docs) {
         const data = doc.data();
         const creatorEmail = await getEmail(data.createdBy);
         fetchedTopics.push({
          id: doc.id,
          name: data.name,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          creatorEmail: creatorEmail,
          firstMessage: data.firstMessage || "", // Ensure firstMessage exists
         });
      }

      setTopics(fetchedTopics); // Update the raw list first

      // Sort by relevance using AI
      const rawUserProfile = await fetchUserProfile();
       const flatUserProfile = flattenProfileData(rawUserProfile); // Flatten the profile data

      if (Object.keys(flatUserProfile).length > 0 && fetchedTopics.length > 0) {
        const relevanceInput: SortTopicsByRelevanceInput = {
          topics: fetchedTopics.map(t => ({
            topicId: t.id,
            title: t.name,
            content: t.firstMessage || t.name, // Use first message or title for content
          })),
          userProfile: flatUserProfile, // Use the flattened profile
        };

        try {
          setIsSorting(true); // Indicate sorting started
          const relevanceOutput: SortTopicsByRelevanceOutput = await sortTopicsByRelevance(relevanceInput);
           const topicOrderMap = new Map(relevanceOutput.map((item, index) => [item.topicId, index]));
           const sorted = [...fetchedTopics].sort((a, b) => {
                const orderA = topicOrderMap.get(a.id) ?? Infinity;
                const orderB = topicOrderMap.get(b.id) ?? Infinity;
                return orderA - orderB;
            });
          setSortedTopics(sorted);
        } catch (error) {
          console.error("Error sorting topics by relevance:", error);
          toast({ variant: "destructive", title: "AI Sort Error", description: "Could not sort topics by relevance. Using default order." });
          setSortedTopics(fetchedTopics); // Fallback to default sort
        } finally {
           setIsSorting(false); // Indicate sorting finished
        }

      } else {
         setSortedTopics(fetchedTopics); // Use default sort if no profile or no topics
         setIsSorting(false); // Ensure sorting state is reset
      }

      setLoadingTopics(false);
    }, (error) => {
        console.error("Error fetching topics: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load chat topics." });
        setLoadingTopics(false);
        setIsSorting(false);
    });

    return () => unsubscribe();
  }, [user, toast, fetchUserProfile]); // Add fetchUserProfile dependency


  // Fetch Messages for Selected Topic
  useEffect(() => {
    if (!selectedTopic) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const messagesRef = collection(db, 'chatTopics', selectedTopic.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
       const fetchedMessages: Message[] = [];
        const userEmails: Record<string, string> = {}; // Cache emails

       // Helper to get email (basic caching) - reuse from topic fetch or adapt
      const getEmail = async (userId: string) => {
        if (userEmails[userId]) return userEmails[userId];
         try {
           if(userId === user?.uid) return user?.email || 'Unknown User';
           const userDoc = await getDoc(doc(db, 'users', userId)); // Assuming a 'users' collection
           const email = userDoc.exists() && userDoc.data()?.email ? userDoc.data().email : 'Unknown User';
           userEmails[userId] = email;
           return email;
         } catch (error) {
           console.error("Error fetching user email for message:", error);
           return 'Unknown User';
         }
      };

       for (const doc of querySnapshot.docs) {
         const data = doc.data();
         const messageUserEmail = await getEmail(data.userId);
         fetchedMessages.push({
          id: doc.id,
          text: data.text,
          userId: data.userId,
          createdAt: data.createdAt,
          userEmail: messageUserEmail,
         });
      }
      setMessages(fetchedMessages);
      setLoadingMessages(false);
    }, (error) => {
        console.error(`Error fetching messages for topic ${selectedTopic.id}: `, error);
        toast({ variant: "destructive", title: "Error", description: "Could not load messages." });
        setLoadingMessages(false);
    });


    return () => unsubscribe();
  }, [selectedTopic, user, toast]); // Added user dependency


  // Handlers
  const handleCreateTopic = async (values: z.infer<typeof NewTopicSchema>) => {
    if (!user) return;
    setIsCreatingTopic(true);
    try {
      const docRef = await addDoc(collection(db, 'chatTopics'), {
        name: values.name,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        firstMessage: values.text, // Save the first message content
      });
      // Add the initial message to the subcollection
      await addDoc(collection(db, 'chatTopics', docRef.id, 'messages'), {
        text: values.text,
        userId: user.uid,
        createdAt: Timestamp.now(),
      });

      toast({ title: 'Topic Created', description: `"${values.name}" has been successfully created.` });
      newTopicForm.reset();
      setIsNewTopicDialogOpen(false); // Close dialog on success
    } catch (error) {
      console.error('Error creating topic:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create topic.' });
    } finally {
      setIsCreatingTopic(false);
    }
  };

  const handleSendMessage = async (values: z.infer<typeof NewMessageSchema>) => {
    if (!user || !selectedTopic) return;
    setIsSendingMessage(true);
    try {
      await addDoc(collection(db, 'chatTopics', selectedTopic.id, 'messages'), {
        text: values.text,
        userId: user.uid,
        createdAt: Timestamp.now(),
      });
      newMessageForm.reset();
      // Optionally scroll to bottom after sending
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const selectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    newMessageForm.reset(); // Reset message input when changing topics
  };

  const backToTopics = () => {
    setSelectedTopic(null);
  };

  // --- Render Logic ---

  // Topic List View
 if (!selectedTopic) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
             <MessageSquare className="h-7 w-7" /> Chat Topics {isSorting && <Loader2 className="h-5 w-5 animate-spin" />}
          </h1>
          <Dialog open={isNewTopicDialogOpen} onOpenChange={setIsNewTopicDialogOpen}>
            <DialogTrigger asChild>
               <Button disabled={isSorting}>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Topic
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Chat Topic</DialogTitle>
              </DialogHeader>
              <Form {...newTopicForm}>
                <form onSubmit={newTopicForm.handleSubmit(handleCreateTopic)} className="space-y-4">
                  <FormField
                    control={newTopicForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Topic Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Study Techniques" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newTopicForm.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Message</FormLabel>
                        <FormControl><Textarea placeholder="Start the conversation..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                     <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isCreatingTopic}>
                      {isCreatingTopic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create Topic
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {loadingTopics ? ( // Show skeleton only during initial load
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : sortedTopics.length === 0 ? (
          <Card className="text-center py-12">
             <CardContent>
                 <p className="text-muted-foreground">No topics found. Be the first to create one!</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="flex-1 pr-4 -mr-4"> {/* Add ScrollArea */}
            <div className="space-y-4">
                {sortedTopics.map((topic) => (
                    <Card
                    key={topic.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${isSorting ? 'opacity-50 pointer-events-none' : ''}`} // Dim while sorting
                    onClick={() => !isSorting && selectTopic(topic)} // Prevent selection while sorting
                    >
                    <CardHeader>
                        <CardTitle>{topic.name}</CardTitle>
                         <CardDescription className="text-xs text-muted-foreground">
                            Created by {topic.creatorEmail || 'Unknown User'} - {formatDistanceToNow(topic.createdAt.toDate(), { addSuffix: true })}
                         </CardDescription>
                    </CardHeader>
                     <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">{topic.firstMessage || <i>No initial message provided.</i>}</p>
                    </CardContent>
                    </Card>
                ))}
            </div>
         </ScrollArea>
        )}
      </div>
    );
  }

 // Message View (When a topic is selected)
 return (
    <div className="container mx-auto py-8 px-4 md:px-0 h-full flex flex-col">
      <div className="flex items-center mb-4">
        <Button variant="ghost" size="icon" onClick={backToTopics} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-primary truncate">{selectedTopic.name}</h1>
      </div>
        <CardDescription className="text-xs text-muted-foreground mb-4 ml-12"> {/* Adjust margin as needed */}
            Started by {selectedTopic.creatorEmail || 'Unknown User'} - {formatDistanceToNow(selectedTopic.createdAt.toDate(), { addSuffix: true })}
        </CardDescription>
        <Separator className="mb-4"/>


      <ScrollArea className="flex-1 mb-4 pr-4 -mr-4"> {/* Add ScrollArea */}
          <div className="space-y-4">
            {loadingMessages ? (
               <div className="space-y-4">
                 <Skeleton className="h-16 w-3/4" />
                 <Skeleton className="h-16 w-3/4 ml-auto" />
                 <Skeleton className="h-16 w-3/4" />
               </div>
            ) : messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No messages yet. Start the conversation!</p>
            ): (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.userId === user?.uid ? 'items-end' : 'items-start'}`}
                >
                  <Card className={`max-w-[75%] p-3 ${message.userId === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                     <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  </Card>
                  <span className="text-xs text-muted-foreground mt-1 px-1">
                     {message.userEmail || 'Unknown User'} - {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </div>
       </ScrollArea>

      <Form {...newMessageForm}>
        <form onSubmit={newMessageForm.handleSubmit(handleSendMessage)} className="flex items-start gap-2 mt-auto pt-4 border-t">
          <FormField
            control={newMessageForm.control}
            name="text"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                   <Textarea
                    placeholder="Type your message..."
                    {...field}
                    rows={1} // Start with 1 row
                    className="min-h-[40px] resize-none" // Prevent manual resize handle, adjust min-height
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault(); // Prevent newline on Enter
                            if (!newMessageForm.formState.isSubmitting && newMessageForm.getValues("text").trim()) {
                                newMessageForm.handleSubmit(handleSendMessage)(); // Submit form
                            }
                        }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSendingMessage || !newMessageForm.formState.isValid} size="icon">
            {isSendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send Message</span>
          </Button>
        </form>
      </Form>
    </div>
  );
}

