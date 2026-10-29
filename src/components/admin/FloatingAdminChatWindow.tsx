
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { XIcon, Users, ChevronLeft, Minimize2, Maximize2, ShieldCheck, UserCircle } from 'lucide-react';
import AdminUserListForChat from './AdminUserListForChat';
import AdminChatMessageArea from './AdminChatMessageArea';
import type { FirestoreUser } from '@/types/firestore';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import UserDetailsModal from './UserDetailsModal';
import { doc, updateDoc, query, collection, where, limit, getDocs } from '@/lib/mysqlDb';
import { db } from '@/lib/firebase';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { useToast } from '@/hooks/use-toast';

interface FloatingAdminChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FloatingAdminChatWindow({ isOpen, onClose }: FloatingAdminChatWindowProps) {
  const [selectedChatUser, setSelectedChatUser] = useState<FirestoreUser | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportOffset, setViewportOffset] = useState<number>(0);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const handleUpdateUserFromModal = async (updatedUserData: Partial<FirestoreUser>) => {
    if (!selectedChatUser?.id) return false;
    try {
      if (updatedUserData.email) {
        const emailQuery = query(collection(db, "users"), where("email", "==", updatedUserData.email.toLowerCase()), limit(1));
        const emailSnap = await getDocs(emailQuery);
        if (!emailSnap.empty && emailSnap.docs[0].id !== selectedChatUser.id) {
          toast({ title: "Update Failed", description: "This email address is already linked to another account.", variant: "destructive" });
          return false;
        }
      }
      if (updatedUserData.mobileNumber) {
        const phoneQuery = query(collection(db, "users"), where("mobileNumber", "==", updatedUserData.mobileNumber), limit(1));
        const phoneSnap = await getDocs(phoneQuery);
        if (!phoneSnap.empty && phoneSnap.docs[0].id !== selectedChatUser.id) {
          toast({ title: "Update Failed", description: "This mobile number is already linked to another account.", variant: "destructive" });
          return false;
        }
      }
      await updateDoc(doc(db, "users", selectedChatUser.id), updatedUserData);
      await triggerRefresh('users');
      setSelectedChatUser(prev => prev ? ({ ...prev, ...updatedUserData }) : null);
      toast({ title: "Updated", description: "User details synchronized." });
      setIsUserDetailsOpen(false);
      return true;
    } catch (error) {
      toast({ title: "Update Failed", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        setViewportOffset(window.visualViewport.offsetTop);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSelectedChatUser(null);
      setIsUserDetailsOpen(false);
    }
  }, [isOpen]);

  if (!isMounted) return null;

  const windowVariants = {
    hidden: { 
      opacity: 0, 
      y: 20, 
      scale: 0.95,
      transformOrigin: isMobile ? 'center' : 'bottom right'
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: 'spring', damping: 25, stiffness: 300 }
    },
    exit: { 
      opacity: 0, 
      y: 20, 
      scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="admin-floating-chat-window"
            initial="hidden"
            animate="visible"
            exit="exit"
          variants={windowVariants}
          className={cn(
            "fixed z-50 flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ease-in-out no-keyboard-scroll",
            isMobile 
              ? "inset-0 bg-background w-full" 
              : cn(
                  "border bg-card rounded-2xl",
                  isMaximized 
                    ? "inset-6 w-auto h-auto" 
                    : "bottom-24 right-6 w-[850px] h-[650px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)]"
                )
          )}
          style={viewportHeight && isMobile ? { 
            position: 'fixed',
            top: `${viewportOffset}px`,
            left: 0,
            right: 0,
            height: `${viewportHeight}px`,
            borderRadius: 0
          } : undefined}
        >
          {isMobile ? (
            /* Mobile View Layout */
            <div className="flex flex-col h-full w-full">
              <header className="px-3 py-2.5 border-b flex-shrink-0 flex items-center justify-between bg-card gap-2">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  {selectedChatUser ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedChatUser(null)} className="h-8 w-8 rounded-full shrink-0 -ml-1">
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <div 
                        className="flex items-center space-x-2 min-w-0 flex-1 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all select-none"
                        onClick={() => setIsUserDetailsOpen(true)}
                        title="Click to view user details"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-8 w-8 border border-primary/20">
                            <AvatarImage src={selectedChatUser.photoURL || undefined} alt={selectedChatUser.displayName || selectedChatUser.email || ""} />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                              {selectedChatUser.displayName ? selectedChatUser.displayName.charAt(0).toUpperCase() : <UserCircle size={16}/>}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 border border-background rounded-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <h2 className="text-sm font-bold truncate max-w-[150px] hover:text-primary transition-colors">
                              {selectedChatUser.displayName || selectedChatUser.email || 'Chat'}
                            </h2>
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                            {selectedChatUser.email}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-primary/10 p-1.5 rounded-lg shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-base font-semibold truncate">
                        Admin Messages
                      </h2>
                    </>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full shrink-0">
                  <XIcon className="h-5 w-5" />
                </Button>
              </header>
              
              <div className="flex-grow overflow-hidden relative">
                {!selectedChatUser ? (
                  <div className="absolute inset-0">
                    <AdminUserListForChat 
                      onSelectUser={setSelectedChatUser} 
                      selectedUserId={(selectedChatUser as any)?.id || ""}
                      scrollAreaHeightClass="h-[calc(100vh-64px)]"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0">
                    <AdminChatMessageArea selectedUser={selectedChatUser} onViewUserDetails={() => setIsUserDetailsOpen(true)} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Desktop View Layout */
            <Card className="h-full flex flex-col border-0 shadow-none rounded-none">
              <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-card shrink-0">
                <div 
                  className={cn(
                    "flex items-center space-x-3",
                    selectedChatUser && "cursor-pointer hover:opacity-85 transition-opacity"
                  )}
                  onClick={() => {
                    if (selectedChatUser) setIsUserDetailsOpen(true);
                  }}
                  title={selectedChatUser ? "Click to view user details" : undefined}
                >
                  <div className="bg-primary/10 p-2 rounded-xl">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold hover:text-primary transition-colors">
                      {selectedChatUser ? `Chat with ${selectedChatUser.displayName || selectedChatUser.email}` : "Customer Support Chat"}
                    </CardTitle>
                    {!selectedChatUser && <p className="text-xs text-muted-foreground">Manage your conversations with users</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsMaximized(!isMaximized)} 
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose} 
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <XIcon className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0 flex-grow overflow-hidden flex bg-muted/5">
                <div className="w-[320px] shrink-0 border-r bg-card/50 backdrop-blur-sm">
                  <AdminUserListForChat
                    onSelectUser={setSelectedChatUser}
                    selectedUserId={selectedChatUser?.id}
                    scrollAreaHeightClass={isMaximized ? "h-[calc(100vh-160px)]" : "h-[560px]"}
                  />
                </div>
                <div className="flex-grow flex flex-col bg-background">
                  <AdminChatMessageArea selectedUser={selectedChatUser} onViewUserDetails={() => setIsUserDetailsOpen(true)} />
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </AnimatePresence>

    {selectedChatUser && (
      <Dialog open={isUserDetailsOpen} onOpenChange={setIsUserDetailsOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card z-[60]">
          <UserDetailsModal 
            user={selectedChatUser} 
            onClose={() => setIsUserDetailsOpen(false)} 
            onUpdateUser={handleUpdateUserFromModal} 
          />
        </DialogContent>
      </Dialog>
    )}
  </>
);
}
