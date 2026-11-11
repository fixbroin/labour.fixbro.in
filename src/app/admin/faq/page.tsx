"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Loader2, HelpCircle, Sparkles } from "lucide-react";
import type { FirestoreFAQ } from '@/types/firestore';
import FAQForm from '@/components/admin/FAQForm';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, query, orderBy, onSnapshot, addDoc, updateDoc, Timestamp } from '@/lib/mysqlDb';
import { useToast } from "@/hooks/use-toast";
import { triggerRefresh } from '@/lib/revalidateUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PermissionGuard from '@/components/admin/PermissionGuard';
import { DEFAULT_DAILY_LABOUR_FAQS } from '@/lib/defaultDailyLabourFaqs';

export default function AdminFAQPage() {
  const [faqs, setFaqs] = useState<FirestoreFAQ[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FirestoreFAQ | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeedingDefault, setIsSeedingDefault] = useState(false);
  const { toast } = useToast();

  const faqsCollectionRef = collection(db, "adminFAQs");

  useEffect(() => {
    const q = query(faqsCollectionRef, orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFaqs(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreFAQ)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching FAQs: ", error);
      toast({ title: "Error", description: "Could not fetch FAQs.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddFAQ = () => {
    setEditingFAQ(null);
    setIsFormOpen(true);
  };

  const handleEditFAQ = (faq: FirestoreFAQ) => {
    setEditingFAQ(faq);
    setIsFormOpen(true);
  };

  const handleDeleteFAQ = async (id: string) => {
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "adminFAQs", id));
      await triggerRefresh('faqs');
      toast({ title: "Success", description: "FAQ deleted successfully." });
    } catch (error) {
      console.error("Error deleting FAQ: ", error);
      toast({ title: "Error", description: "Could not delete FAQ.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadDefaultFAQs = async () => {
    setIsSeedingDefault(true);
    try {
      // Fetch existing questions to avoid any duplicates
      const snap = await getDocs(faqsCollectionRef);
      const existingQuestions = new Set<string>();
      snap.docs.forEach(d => {
        const q = (d.data().question || '').trim().toLowerCase();
        if (q) existingQuestions.add(q);
      });

      const faqsToAdd = DEFAULT_DAILY_LABOUR_FAQS.filter(
        item => !existingQuestions.has(item.question.trim().toLowerCase())
      );

      if (faqsToAdd.length === 0) {
        toast({
          title: "FAQs Already Exist",
          description: "All 10 default Daily Labour FAQs are already present in the database."
        });
        return;
      }

      for (const item of faqsToAdd) {
        await addDoc(faqsCollectionRef, {
          question: item.question,
          answer: item.answer,
          order: item.order,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      await triggerRefresh('faqs');
      toast({
        title: "Default FAQs Created!",
        description: `Successfully loaded ${faqsToAdd.length} default Daily Labour FAQs.`,
        className: "bg-green-100 text-green-700 border-green-300"
      });
    } catch (error) {
      console.error("Error loading default FAQs:", error);
      toast({
        title: "Error",
        description: (error as Error).message || "Could not load default FAQs.",
        variant: "destructive"
      });
    } finally {
      setIsSeedingDefault(false);
    }
  };

  const handleFormSubmit = async (data: Omit<FirestoreFAQ, "createdAt" | "updatedAt" | "id"> & { id?: string; }) => {
    setIsSubmitting(true);
    try {
      const { id, ...faqData } = data;
      if (id) {
        await updateDoc(doc(db, "adminFAQs", id), { ...faqData, updatedAt: Timestamp.now() });
        toast({ title: "Success", description: "FAQ updated successfully." });
      } else {
        await addDoc(collection(db, "adminFAQs"), { ...faqData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        toast({ title: "Success", description: "New FAQ added." });
      }
      await triggerRefresh('faqs');
      setIsFormOpen(false);
      setEditingFAQ(null);
    } catch (error) {
      console.error("Error saving FAQ: ", error);
      toast({ title: "Error", description: "Could not save FAQ.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <HelpCircle className="mr-2 h-6 w-6 text-primary" />
              FAQ Management
            </CardTitle>
            <CardDescription>
              Manage frequently asked questions for FixBro Daily Labour.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <PermissionGuard moduleId="faq" action="create">
              <Button
                variant="outline"
                onClick={handleLoadDefaultFAQs}
                disabled={isSubmitting || isLoading || isSeedingDefault}
                className="w-full sm:w-auto"
              >
                {isSeedingDefault ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-primary" />}
                Load Default FAQs
              </Button>
            </PermissionGuard>
            <PermissionGuard moduleId="faq" action="create">
              <Button onClick={handleAddFAQ} disabled={isSubmitting || isLoading || isSeedingDefault} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New FAQ
              </Button>
            </PermissionGuard>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading FAQs...</p>
            </div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-12 px-4 text-muted-foreground border-2 border-dashed rounded-2xl space-y-3">
              <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="font-semibold text-foreground">No FAQs currently available</p>
                <p className="text-xs text-muted-foreground mt-1">You can add your own FAQ or click below to load the 10 default Daily Labour questions.</p>
              </div>
              <Button
                variant="default"
                onClick={handleLoadDefaultFAQs}
                disabled={isSeedingDefault}
                className="rounded-xl font-semibold mt-2"
              >
                {isSeedingDefault ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Load 10 Default Daily Labour FAQs
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Order</TableHead>
                    <TableHead className="w-1/3">Question</TableHead>
                    <TableHead>Answer Preview</TableHead>
                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faqs.map((faq) => (
                    <TableRow key={faq.id}>
                      <TableCell className="font-mono font-bold align-top text-center text-primary">{faq.order ?? 0}</TableCell>
                      <TableCell className="font-medium align-top">{faq.question}</TableCell>
                      <TableCell className="max-w-md truncate align-top text-muted-foreground text-xs">{faq.answer}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2 sm:justify-end">
                          <PermissionGuard moduleId="faq" action="write">
                            <Button variant="outline" size="icon" onClick={() => handleEditFAQ(faq)} disabled={isSubmitting}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard moduleId="faq" action="delete">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" disabled={isSubmitting}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this FAQ.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteFAQ(faq.id!)}
                                    disabled={isSubmitting}
                                    className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </PermissionGuard>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSubmitting) { setIsFormOpen(open); if (!open) setEditingFAQ(null); } }}>
        <DialogContent className="w-full max-w-2xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-3 pb-4 border-b bg-muted/20">
            <DialogTitle>{editingFAQ ? 'Edit FAQ' : 'Add New FAQ'}</DialogTitle>
            <DialogDescription>
              {editingFAQ ? 'Update the question or its answer.' : 'Create a new frequently asked question.'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-3">
            <FAQForm
                onSubmit={handleFormSubmit}
                initialData={editingFAQ}
                onCancel={() => {
                setIsFormOpen(false);
                setEditingFAQ(null);
                }}
                isSubmitting={isSubmitting}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
