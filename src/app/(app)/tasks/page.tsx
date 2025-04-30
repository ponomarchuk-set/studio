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
  updateDoc,
  deleteDoc,
  where,
  DocumentData,
  getDoc,
  getDocs,
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
import { PlusCircle, ListChecks, Trash2, Edit2, Star, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { sortTopicsByRelevance, SortTopicsByRelevanceInput, SortTopicsByRelevanceOutput } from '@/ai/flows/sort-topics-by-relevance'; // Reuse sorting flow
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';

// Schemas
const TaskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long.'),
  description: z.string().optional(),
  rating: z.number().min(0).max(5).default(0), // 0-5 star rating
});

type Task = {
  id: string;
  title: string;
  description?: string;
  rating: number;
  completed: boolean;
  createdBy: string;
  createdAt: Timestamp;
  creatorEmail?: string; // Optional
};

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sortedTasks, setSortedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // General processing state for add/edit/delete
  const [isSorting, setIsSorting] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);


   const taskForm = useForm<z.infer<typeof TaskSchema>>({
    resolver: zodResolver(TaskSchema),
    defaultValues: { title: '', description: '', rating: 0 },
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

  // Fetch and Sort Tasks
  useEffect(() => {
    if (!user) {
        setLoading(false);
        return; // Don't fetch if user is not logged in
    };
    setLoading(true);
    setIsSorting(true);
    // Query tasks created by the current user
    const q = query(
        collection(db, 'tasks'),
        where('createdBy', '==', user.uid), // Filter by user ID
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const fetchedTasks: Task[] = [];
       // No need to fetch emails if we only show user's own tasks
       // const userEmail = user?.email || 'Me'; // Use logged-in user's email

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        fetchedTasks.push({
          id: docSnapshot.id,
          title: data.title,
          description: data.description,
          rating: data.rating || 0,
          completed: data.completed || false,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          creatorEmail: user?.email || 'Me', // Assign current user's email
        });
      });

      setTasks(fetchedTasks); // Update raw list

       // Sort by relevance using AI (Optional: Could also sort by completion status or rating client-side)
      const userProfile = await fetchUserProfile();
      if (userProfile && fetchedTasks.length > 0) {
         const relevanceInput: SortTopicsByRelevanceInput = {
           topics: fetchedTasks.map(t => ({ // Treat tasks as "topics" for the AI
             topicId: t.id,
             title: t.title,
             content: t.description || t.title, // Use description or title for content
           })),
           userProfile: userProfile as Record<string, string | number>,
         };

         try {
           const relevanceOutput: SortTopicsByRelevanceOutput = await sortTopicsByRelevance(relevanceInput);
            const topicOrderMap = new Map(relevanceOutput.map((item, index) => [item.topicId, index]));
           const sorted = [...fetchedTasks].sort((a, b) => {
                const orderA = topicOrderMap.get(a.id) ?? Infinity;
                const orderB = topicOrderMap.get(b.id) ?? Infinity;
                return orderA - orderB;
           });
           setSortedTasks(sorted);
         } catch (error) {
           console.error("Error sorting tasks by relevance:", error);
           toast({ variant: "destructive", title: "AI Sort Error", description: "Could not sort tasks by relevance." });
           setSortedTasks(fetchedTasks); // Fallback
         }
      } else {
         setSortedTasks(fetchedTasks); // Fallback
      }

      setLoading(false);
      setIsSorting(false);
    }, (error) => {
      console.error("Error fetching tasks: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load tasks." });
      setLoading(false);
      setIsSorting(false);
    });

    return () => unsubscribe();
  }, [user, toast, fetchUserProfile]); // Depend on user

   // Handlers
  const handleFormSubmit = async (values: z.infer<typeof TaskSchema>) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      if (editingTask) {
        // Update existing task
        const taskRef = doc(db, 'tasks', editingTask.id);
        await updateDoc(taskRef, {
           ...values, // Update fields from form
        });
        toast({ title: 'Task Updated', description: `"${values.title}" updated successfully.` });
      } else {
        // Add new task
        await addDoc(collection(db, 'tasks'), {
          ...values,
          completed: false,
          createdBy: user.uid,
          createdAt: Timestamp.now(),
        });
        toast({ title: 'Task Created', description: `"${values.title}" created successfully.` });
      }
      closeFormDialog();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save task.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
     if (!user) return;
     const taskRef = doc(db, 'tasks', task.id);
     try {
         await updateDoc(taskRef, { completed: !task.completed });
         toast({
             title: `Task ${task.completed ? 'Marked Incomplete' : 'Completed'}`,
             description: `"${task.title}" status updated.`,
            });
     } catch (error) {
        console.error('Error updating task status:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update task status.' });
     }
   };


  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    setIsProcessing(true); // Use general processing state
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskRef);
      toast({ title: 'Task Deleted', description: 'Task removed successfully.' });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete task.' });
    } finally {
       setIsProcessing(false);
    }
  };


   const openEditDialog = (task: Task) => {
     setEditingTask(task);
     taskForm.reset({ // Populate form with task data
       title: task.title,
       description: task.description || '',
       rating: task.rating || 0,
     });
     setIsFormDialogOpen(true);
   };

   const openNewDialog = () => {
     setEditingTask(null);
     taskForm.reset({ title: '', description: '', rating: 0 }); // Reset form for new task
     setIsFormDialogOpen(true);
   };

   const closeFormDialog = () => {
        setIsFormDialogOpen(false);
        setEditingTask(null);
        taskForm.reset(); // Clear form on close
   }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
             <ListChecks className="h-7 w-7" /> Tasks
        </h1>
         <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={openNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Task
                </Button>
            </DialogTrigger>
             <DialogContent onInteractOutside={(e) => {
                // Prevent closing while processing
                 if (isProcessing) {
                    e.preventDefault();
                 }
            }} onEscapeKeyDown={(e) => {
                 if (isProcessing) {
                    e.preventDefault();
                 }
            }}>
                <DialogHeader>
                    <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
                </DialogHeader>
                <Form {...taskForm}>
                    <form onSubmit={taskForm.handleSubmit(handleFormSubmit)} className="space-y-4">
                    <FormField
                        control={taskForm.control}
                        name="title"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl><Input placeholder="e.g., Read Chapter 5" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={taskForm.control}
                        name="description"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl><Textarea placeholder="Add more details..." {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating (0-5)</FormLabel>
                           <Select
                                onValueChange={(value) => field.onChange(Number(value))}
                                defaultValue={String(field.value)}
                                disabled={isProcessing}
                            >
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select rating" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {[0, 1, 2, 3, 4, 5].map((rate) => (
                                    <SelectItem key={rate} value={String(rate)}>
                                        <div className="flex items-center">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`h-4 w-4 ${i < rate ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
                                            />
                                            ))}
                                            <span className="ml-2 text-sm">({rate})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isProcessing} onClick={closeFormDialog}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingTask ? 'Update Task' : 'Create Task'}
                        </Button>
                    </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
         </Dialog>
      </div>

      {loading || isSorting ? (
         <div className="space-y-4">
           <Skeleton className="h-24 w-full" />
           <Skeleton className="h-24 w-full" />
           <Skeleton className="h-24 w-full" />
         </div>
       ) : sortedTasks.length === 0 ? (
          <Card className="text-center py-12">
             <CardContent>
                 <p className="text-muted-foreground">No tasks found. Add your first task!</p>
            </CardContent>
          </Card>
       ) : (
            <ScrollArea className="flex-1 pr-4 -mr-4"> {/* Add ScrollArea */}
                 <div className="space-y-4">
                 {sortedTasks.map((task) => (
                     <Card key={task.id} className={`transition-opacity ${task.completed ? 'opacity-60' : ''}`}>
                     <CardContent className="p-4 flex items-start gap-4">
                         <Checkbox
                             id={`task-${task.id}`}
                             checked={task.completed}
                             onCheckedChange={() => handleToggleComplete(task)}
                             aria-label={`Mark task "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
                             className="mt-1"
                         />
                         <div className="flex-1 grid gap-1">
                             <label
                                htmlFor={`task-${task.id}`}
                                className={`font-medium cursor-pointer ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                                onClick={(e) => { e.preventDefault(); handleToggleComplete(task); }} // Toggle on label click too
                             >
                                 {task.title}
                             </label>
                             {task.description && (
                                 <p className={`text-sm text-muted-foreground ${task.completed ? 'line-through' : ''}`}>
                                     {task.description}
                                </p>
                             )}
                            <div className="flex items-center mt-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                    key={i}
                                    className={`h-4 w-4 ${i < task.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/50'}`}
                                    />
                                ))}
                             </div>
                            <span className="text-xs text-muted-foreground mt-1">
                                Created {formatDistanceToNow(task.createdAt.toDate(), { addSuffix: true })}
                             </span>
                         </div>
                         <div className="flex gap-1">
                             <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)} disabled={isProcessing} aria-label={`Edit task ${task.title}`}>
                                 <Edit2 className="h-4 w-4" />
                             </Button>
                             <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={isProcessing}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label={`Delete task ${task.title}`}
                             >
                                 {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                             </Button>
                         </div>
                     </CardContent>
                     </Card>
                 ))}
                 </div>
           </ScrollArea>
       )}
    </div>
  );
}
