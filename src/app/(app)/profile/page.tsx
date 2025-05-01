
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, DocumentData, collection, setDoc as setFirestoreDoc, getDocs } from "firebase/firestore"; // Use specific import for clarity, Added getDocs
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlusCircle, Trash2, UserSearch } from "lucide-react"; // Added UserSearch icon
import { Skeleton } from "@/components/ui/skeleton";
import { UserSelectorDialog, type RegisteredUser } from "@/components/UserSelectorDialog"; // Import UserSelectorDialog

// Define the schema for a single key-value pair
const ProfileItemSchema = z.object({
  key: z.string().min(1, "Key cannot be empty"),
  value: z.string().min(1, "Value cannot be empty"), // Keeping value as string for simplicity (UID for social relations)
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

export type ProfileFormData = z.infer<typeof ProfileSchema>;

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
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
         // If profile doc doesn't exist, create it with default empty structure
         console.log("Profile document not found for user:", user.uid, ". Creating one.");
         const defaultProfileData: ProfileFormData = {
            demographics: [],
            geography: [],
            socialRelations: [],
            features: [],
            skills: [],
            contacts: [],
         };
         // Use setFirestoreDoc here to ensure the document is created
         await setFirestoreDoc(docRef, defaultProfileData);
         form.reset(defaultProfileData);
         console.log("Created new profile document for user:", user.uid);

         // Also ensure the 'users' collection document exists
         const userDocRef = doc(db, "users", user.uid);
         const userDocSnap = await getDoc(userDocRef);
         if (!userDocSnap.exists()) {
             console.log("'users' document not found for user:", user.uid, ". Creating one.");
             await setFirestoreDoc(userDocRef, { email: user.email }); // Store email or other basic info
             console.log("Created new 'users' document for user:", user.uid);
         }

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

  // Fetch registered users for the selector
  const fetchRegisteredUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
        const usersCol = collection(db, "users");
        const usersSnapshot = await getDocs(usersCol);
        const usersList = usersSnapshot.docs.map(doc => ({
            uid: doc.id,
            email: doc.data().email || "No email", // Assuming email is stored
        }));
        setRegisteredUsers(usersList);
    } catch (error) {
        console.error("Error fetching registered users:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not load registered users.",
        });
        setRegisteredUsers([]); // Reset on error
    } finally {
        setLoadingUsers(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchProfileData();
    fetchRegisteredUsers(); // Fetch users when component mounts
  }, [fetchProfileData, fetchRegisteredUsers]);


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
      <div className="space-y-4 p-4 md:p-6">
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
          <Accordion type="multiple" defaultValue={profileSections} collapsible className="w-full space-y-4">
            {profileSections.map((sectionName) => (
              <ProfileSection
                key={sectionName}
                control={form.control}
                sectionName={sectionName}
                title={sectionTitles[sectionName]}
                register={form.register}
                setValue={form.setValue} // Pass setValue
                registeredUsers={registeredUsers} // Pass users
                loadingUsers={loadingUsers} // Pass loading state
                getValues={form.getValues} // Pass getValues
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
  setValue: any; // Add setValue from react-hook-form
  getValues: any; // Add getValues
  registeredUsers: RegisteredUser[]; // Add registered users
  loadingUsers: boolean; // Add loading state for users
}

function ProfileSection({ control, sectionName, title, register, setValue, getValues, registeredUsers, loadingUsers }: ProfileSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: sectionName,
  });

   const [isUserSelectorOpen, setIsUserSelectorOpen] = useState(false);
   const [currentUserIndex, setCurrentUserIndex] = useState<number | null>(null);


  const addNewField = () => {
     append({ key: "", value: "" }, { shouldFocus: true });
  };

  const openUserSelector = (index: number) => {
      setCurrentUserIndex(index);
      setIsUserSelectorOpen(true);
  };

   const handleUserSelect = (selectedUser: RegisteredUser | null) => {
     if (selectedUser && currentUserIndex !== null) {
       // Store the UID as the value
       setValue(`${sectionName}.${currentUserIndex}.value`, selectedUser.uid, { shouldValidate: true, shouldDirty: true });
     }
     setIsUserSelectorOpen(false);
     setCurrentUserIndex(null);
   };

   // Helper to get display value for Social Relations
   const getSocialRelationDisplayValue = (index: number): string => {
        const uid = getValues(`${sectionName}.${index}.value`);
        if (!uid) return "Select User";
        const user = registeredUsers.find(u => u.uid === uid);
        return user ? user.email : uid; // Display email or fallback to UID
   };


  return (
     <AccordionItem value={sectionName} className="border rounded-lg shadow-sm overflow-hidden bg-card">
       <AccordionTrigger className="px-6 py-4 hover:no-underline">
          <span className="text-xl font-semibold text-primary">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6 pt-0">
           <div className="space-y-4"> {/* Container for all fields in the section */}
              {fields.map((field, index) => (
                 // Remove border-b and pb-3 from this div
                <div key={field.id} className="flex items-end gap-2"> {/* Group fields horizontally */}
                   {/* Key Field */}
                   <FormField
                    control={control}
                    name={`${sectionName}.${index}.key`}
                    render={({ field: keyField }) => (
                      <FormItem className="flex-1">
                        {/* Removed FormLabel for Key */}
                        <FormControl>
                           <Input placeholder={`Key ${index + 1}`} {...keyField} aria-label={`Key for ${title} item ${index + 1}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                   {/* Value Field - Conditional Rendering for Social Relations */}
                   {sectionName === "socialRelations" ? (
                        <FormItem className="flex-1">
                            {/* Removed FormLabel for Value */}
                            <div className="flex items-center gap-1">
                                 <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 justify-start text-left font-normal"
                                    onClick={() => openUserSelector(index)}
                                    disabled={loadingUsers}
                                    aria-label={`Select user for ${title} item ${index + 1}`}
                                 >
                                     <span className="truncate">{getSocialRelationDisplayValue(index)}</span>
                                </Button>
                                 <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openUserSelector(index)}
                                    disabled={loadingUsers}
                                    aria-label={`Search user for ${title} item ${index + 1}`}
                                    className="text-muted-foreground"
                                >
                                    <UserSearch className="h-4 w-4" />
                                </Button>
                            </div>
                            {/* Hidden input to actually store the UID */}
                            <FormField
                                control={control}
                                name={`${sectionName}.${index}.value`}
                                render={({ field: valueField }) => (
                                    <FormControl>
                                        <Input type="hidden" {...valueField} />
                                    </FormControl>
                                )}
                             />
                           <FormMessage />
                        </FormItem>
                   ) : (
                       <FormField
                        control={control}
                        name={`${sectionName}.${index}.value`}
                        render={({ field: valueField }) => (
                            <FormItem className="flex-1">
                                {/* Removed FormLabel for Value */}
                                <FormControl>
                                <Input placeholder={`Value ${index + 1}`} {...valueField} aria-label={`Value for ${title} item ${index + 1}`} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                      />
                   )}

                  {/* Remove Button */}
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

         {/* User Selector Dialog */}
        {sectionName === "socialRelations" && (
             <UserSelectorDialog
                isOpen={isUserSelectorOpen}
                onClose={() => setIsUserSelectorOpen(false)}
                users={registeredUsers}
                onSelectUser={handleUserSelect}
                isLoading={loadingUsers}
            />
        )}
      </AccordionItem>
  );
}
