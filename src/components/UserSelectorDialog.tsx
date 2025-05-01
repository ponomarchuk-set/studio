
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from 'lucide-react';

export type RegisteredUser = {
    uid: string;
    email: string;
};

interface UserSelectorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    users: RegisteredUser[];
    onSelectUser: (user: RegisteredUser | null) => void;
    isLoading: boolean;
}

export function UserSelectorDialog({ isOpen, onClose, users, onSelectUser, isLoading }: UserSelectorDialogProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (user: RegisteredUser) => {
        onSelectUser(user);
        setSearchTerm(''); // Reset search on select
        onClose();
    };

    const handleDialogClose = () => {
        setSearchTerm(''); // Reset search on close
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Select User</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Input
                        placeholder="Search by email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isLoading}
                    />
                    <ScrollArea className="h-[300px] border rounded-md">
                        <div className="p-4">
                            {isLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm">No users found.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {filteredUsers.map((user) => (
                                        <li key={user.uid}>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start h-auto py-2 px-3 text-left"
                                                onClick={() => handleSelect(user)}
                                            >
                                                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                                <span className="truncate">{user.email}</span>
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={handleDialogClose}>
                            Cancel
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
