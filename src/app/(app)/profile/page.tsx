"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, DocumentData } from "firebase/firestore";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlusCircle, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Define the schema for a single key-value pair
const ProfileItemSchema = z.object({
  key: z.string().min(1, "Key cannot be empty"),
  value: z.string().min(1, "Value cannot be empty"), // Keeping value as string for simplicity
});

// Define the schema for a profile section (e.g., Demographics)
const ProfileSectionSchema = z.array(ProfileItemSchema);

// Define the overall profile schema
const ProfileSchema = z.object({
  demographics: ProfileSectionSchema,
  geography: ProfileSectionSchema,
  socialRelations: ProfileSectionSchema,
  features: ProfileSectionSchema,
  skills: ProfileSectionSchema,
  contacts: ProfileSectionSchema,
});

type ProfileFormData = z.infer<typeof ProfileSchema>;

const profileSections: (keyof ProfileFormData)[] = [
  "demographics",
  "geography",
  "socialRelations",
  "features",
  "skills",
  "contacts",
];

const sectionTitles: Record<keyof ProfileFormData, string> = {
  demographics: "Demographics",
  geography: "Geography",
  socialRelations: "Social Relations",
  features: "Features",
  skills: "Skills",
  contacts: "Contacts",
};


export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      demographics: [],
      geography: [],
      socialRelations: [],
      features: [],
      skills: [],
      contacts: [],
    },
  });

  const fetchProfileData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docRef = doc(db, "profiles", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as DocumentData;
        // Ensure all sections exist in the fetched data, defaulting to empty array if not
        const validatedData = profileSections.reduce((acc, section) => {
            acc[section] = Array.isArray(data[section]) ? data[section] : [];
            return acc;
          }, {} as ProfileFormData);
        form.reset(validatedData);
      } else {
        // Initialize with default empty structure if no profile exists
         form.reset({
            demographics: [],
            geography: [],
            socialRelations: [],
            features: [],
            skills: [],
            contacts: [],
         });
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load profile data.",
      });
       form.reset(); // Reset to default empty values on error
    } finally {
      setLoading(false);
    }
  }, [user, toast, form]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);


  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "profiles", user.uid);
      await setDoc(docRef, data, { merge: true }); // Use merge: true to avoid overwriting other fields potentially
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
    } catch (error) {
      console.error("Error saving profile data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save profile data.",
      });
    } finally {
       setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/4" />
         {profileSections.map((section) => (
            <Card key={section}>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                 <CardContent className="space-y-4">
                     <Skeleton className="h-8 w-full" />
                     <Skeleton className="h-8 w-full" />
                 </CardContent>
                  <CardFooter>
                       <Skeleton className="h-10 w-24" />
                  </CardFooter>
            </Card>
         ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <h1 className="text-3xl font-bold mb-6 text-primary">Your Profile</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Accordion type="multiple" collapsible className="w-full space-y-4">
            {profileSections.map((sectionName) => (
              <ProfileSection
                key={sectionName}
                control={form.control}
                sectionName={sectionName}
                title={sectionTitles[sectionName]}
                register={form.register}
              />
            ))}
          </Accordion>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </Form>
    </div>
  );
}


interface ProfileSectionProps {
  control: any; // Type appropriately based on react-hook-form version
  sectionName: keyof ProfileFormData;
  title: string;
  register: any; // Type appropriately
}

function ProfileSection({ control, sectionName, title, register }: ProfileSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: sectionName,
  });

  const addNewField = () => {
     append({ key: "", value: "" }, { shouldFocus: true });
  };


  return (
     <AccordionItem value={sectionName} className="border rounded-lg shadow-sm overflow-hidden bg-card">
       <AccordionTrigger className="px-6 py-4 hover:no-underline">
          <span className="text-xl font-semibold text-primary">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6 pt-0">
          <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 p-3 border rounded-md bg-background">
                   <FormField
                    control={control}
                    name={`${sectionName}.${index}.key`}
                    render={({ field: keyField }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Key</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., City" {...keyField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`${sectionName}.${index}.value`}
                    render={({ field: valueField }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Value</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., New York" {...valueField} />
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
                    className="text-destructive hover:bg-destructive/10"
                    aria-label={`Remove ${title} item ${index + 1}`}
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
                onClick={addNewField}
                className="mt-4 border-dashed border-accent text-accent hover:bg-accent/10 hover:text-accent"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
             </Button>
        </AccordionContent>
      </AccordionItem>
  );
}
