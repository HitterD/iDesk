/**
 * UnsavedChangesDialog Component
 * 
 * A modal dialog that appears when user tries to navigate away with unsaved changes.
 */

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean;
    /** Called when user confirms leaving */
    onConfirm: () => void;
    /** Called when user cancels and stays */
    onCancel: () => void;
    /** Custom title */
    title?: string;
    /** Custom message */
    message?: string;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Unsaved Changes',
    message = 'You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?',
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-start gap-4">
                        {/* Warning Icon */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                            <DialogTitle className="text-lg font-semibold">
                                {title}
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                {message}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <DialogFooter className="mt-4 gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Stay on Page
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                        Leave Without Saving
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UnsavedChangesDialog;
