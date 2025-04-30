"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home,
  User,
  Sparkles,
  MessageSquare,
  Vote,
  ListChecks,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


const navItems = [
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/values', label: 'Values', icon: Sparkles },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/voting', label: 'Voting', icon: Vote },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: 'An error occurred during logout.',
      });
    }
  };

   const getInitials = (email: string | null | undefined) => {
    if (!email) return 'U';
    const nameParts = email.split('@')[0];
    return nameParts?.[0]?.toUpperCase() ?? 'U';
  };


  return (
    <AuthGuard>
        <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen bg-background">
                <Sidebar>
                     <SidebarHeader className="p-4 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
                          <Home className="h-6 w-6" />
                          <span>StudyHub</span>
                        </Link>
                        {/* SidebarTrigger is automatically handled by SidebarProvider */}
                    </SidebarHeader>
                    <SidebarContent className="flex-1 overflow-y-auto">
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <Link href={item.href} passHref legacyBehavior>
                                        <SidebarMenuButton
                                            isActive={pathname === item.href || (pathname?.startsWith(item.href) && item.href !== '/')}
                                            tooltip={item.label}
                                        >
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarContent>
                     <SidebarSeparator />
                    <SidebarFooter className="p-4">
                         <div className="flex items-center gap-3 mb-4">
                             <Avatar className="h-9 w-9">
                              {/* Placeholder for user avatar image */}
                              {/* <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} /> */}
                              <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-0.5 text-xs">
                                <div className="font-medium truncate">{user?.displayName || user?.email}</div>
                                <div className="text-muted-foreground truncate">{user?.email}</div>
                            </div>
                         </div>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                                    <LogOut />
                                    <span>Logout</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                </Sidebar>

                <SidebarInset className="flex flex-col flex-1">
                     <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
                        {/* Mobile Header - Removed asChild from SidebarTrigger */}
                         <SidebarTrigger>
                            <Button size="icon" variant="outline">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle Menu</span>
                            </Button>
                        </SidebarTrigger>
                        <h1 className="text-lg font-semibold text-primary">StudyHub</h1>
                    </header>
                    <main className="flex-1 p-4 md:p-6 overflow-auto">
                        {children}
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    </AuthGuard>
  );
}
