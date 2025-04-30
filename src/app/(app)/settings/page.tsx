"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <h1 className="text-3xl font-bold mb-6 text-primary flex items-center gap-2">
        <SettingsIcon className="h-7 w-7" /> Settings
      </h1>
      <Card>
        <CardHeader>
            <CardTitle>Application Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Settings page is currently under construction.</p>
          {/* Future settings options will go here */}
        </CardContent>
      </Card>
    </div>
  );
}
