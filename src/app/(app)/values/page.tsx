
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

// Define the schema for a single value item
const ValueItemSchema = z.object({
  name: z.string().min(1, "Value name cannot be empty"),
  importance: z.number().min(0, "Importance must be non-negative").max(100, "Importance cannot exceed 100"),
});

// Define the overall values schema
const ValuesSchema = z.object({
  values: z.array(ValueItemSchema),
}).refine(
  (data) => {
    const totalImportance = data.values.reduce((sum, value) => sum + value.importance, 0);
    return totalImportance <= 100;
  },
  {
    message: "The total importance of all values cannot exceed 100.",
    path: ["values"], // Attach the error to the 'values' field array itself
  }
);


type ValuesFormData = z.infer<typeof ValuesSchema>;

export default function ValuesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [totalImportance, setTotalImportance] = useState(0);


  const form = useForm<ValuesFormData>({
    resolver: zodResolver(ValuesSchema),
    defaultValues: {
      values: [],
    },
    mode: "onChange", // Recalculate total on change
  });

   const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "values",
  });

  // Watch for changes in the values array to update the total importance
  const watchedValues = form.watch("values");
  useEffect(() => {
    const currentTotal = watchedValues.reduce((sum, value) => sum + (Number(value.importance) || 0), 0);
    setTotalImportance(currentTotal);
  }, [watchedValues]);


  const fetchValuesData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docRef = doc(db, "values", user.uid); // Store values in a separate collection or subcollection
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
         const data = docSnap.data();
         // Ensure data structure matches schema, defaulting if needed
         const validatedData = ValuesSchema.safeParse(data);
         if (validatedData.success) {
            form.reset(validatedData.data);
         } else {
            console.warn("Fetched data does not match schema, resetting.", validatedData.error);
            form.reset({ values: [] }); // Reset if data is invalid
         }

      } else {
         form.reset({ values: [] }); // Initialize with default if no data exists
      }
    } catch (error) {
      console.error("Error fetching values data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load values data.",
      });
      form.reset({ values: [] });
    } finally {
      setLoading(false);
    }
  }, [user, toast, form]);

  useEffect(() => {
    fetchValuesData();
  }, [fetchValuesData]);


  const onSubmit = async (data: ValuesFormData) => {
    if (!user) return;
    setIsSaving(true);

    const finalTotal = data.values.reduce((sum, value) => sum + value.importance, 0);
    if (finalTotal > 100) {
         toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Total importance cannot exceed 100.",
          });
         setIsSaving(false);
         return; // Prevent saving if validation fails server-side (though client-side should catch it)
    }


    try {
      const docRef = doc(db, "values", user.uid);
      await setDoc(docRef, data); // Overwrite with the new set of values
      toast({
        title: "Values Updated",
        description: "Your life values have been saved.",
      });
    } catch (error) {
      console.error("Error saving values data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save values data.",
      });
    } finally {
      setIsSaving(false);
    }
  };

   const addNewValue = () => {
     append({ name: "", importance: 0 }, { shouldFocus: true });
   };


  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Card>
             <CardHeader>
                 <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
             </CardHeader>
              <CardContent className="space-y-6">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
              </CardContent>
               <CardFooter className="flex justify-between items-center">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-6 w-32" />
               </CardFooter>
         </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <h1 className="text-3xl font-bold mb-6 text-primary">Your Life Values</h1>

      <Card className="mb-6">
          <CardHeader>
             <CardTitle>Define Your Values</CardTitle>
             <CardDescription>
                List the values that are most important to you and assign an importance score (0-100).
                The total importance across all values cannot exceed 100.
            </CardDescription>
          </CardHeader>
          <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                       <div key={field.id} className="flex flex-col md:flex-row items-start md:items-end gap-4 p-4 border rounded-lg bg-background shadow-sm">
                        <FormField
                          control={form.control}
                          name={`values.${index}.name`}
                          render={({ field: nameField }) => (
                            <FormItem className="flex-1 w-full md:w-auto">
                              <FormControl>
                                <Input placeholder="Value (e.g., Honesty, Growth)" {...nameField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                       <Controller
                          control={form.control}
                          name={`values.${index}.importance`}
                          render={({ field: { onChange, value, ...restField } }) => (
                            <FormItem className="flex-1 w-full md:w-auto">
                               <div className="flex justify-between items-center mb-1">
                                <FormLabel>Importance</FormLabel>
                                <span className="text-sm font-medium text-primary">{value ?? 0}</span>
                               </div>
                              <FormControl>
                                 <Slider
                                  {...restField}
                                  value={[value ?? 0]} // Ensure value is an array for the slider
                                  onValueChange={(vals) => onChange(vals[0])} // Update form with the first value
                                  max={100}
                                  step={1}
                                  aria-label={`Importance for ${form.watch(`values.${index}.name`)}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />


                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="text-destructive hover:bg-destructive/10 mt-2 md:mt-0"
                          aria-label={`Remove value ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                   <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewValue}
                    className="mt-4 border-dashed border-accent text-accent hover:bg-accent/10 hover:text-accent"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Value
                  </Button>

                    {form.formState.errors.values && (
                        <Alert variant="destructive">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>
                            {form.formState.errors.values.message || "Please fix the errors in the values list."}
                            </AlertDescription>
                        </Alert>
                    )}

                   <div className="mt-6 space-y-2">
                      <div className="flex justify-between items-center text-sm font-medium">
                          <span>Total Importance:</span>
                          <span className={totalImportance > 100 ? 'text-destructive' : 'text-primary'}>
                                {totalImportance} / 100
                          </span>
                      </div>
                       <Progress value={totalImportance} max={100} className={totalImportance > 100 ? '[&>div]:bg-destructive' : ''} />
                        {totalImportance > 100 && (
                            <p className="text-xs text-destructive text-right">Total importance exceeds 100!</p>
                        )}
                   </div>


                  <Button type="submit" disabled={isSaving || totalImportance > 100}>
                     {isSaving ? "Saving..." : "Save Values"}
                  </Button>
                </form>
              </Form>
          </CardContent>

      </Card>


    </div>
  );
}

