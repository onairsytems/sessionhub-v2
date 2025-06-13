import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Pause, 
  Play, 
  StopCircle, 
  AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface QueueControlsProps {
  isPaused: boolean;
  selectedCount: number;
  totalCount: number;
  onPause: () => void;
  onResume: () => void;
  onSelectAll: () => void;
  onCancelSelected: () => void;
}

export function QueueControls({
  isPaused,
  selectedCount,
  totalCount,
  onPause,
  onResume,
  onSelectAll,
  onCancelSelected
}: QueueControlsProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant={isPaused ? 'primary' : 'outline'}
              size="sm"
              onClick={isPaused ? onResume : onPause}
              className="flex items-center gap-2"
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  Resume Queue
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pause Queue
                </>
              )}
            </Button>

            <div className="flex items-center gap-2 border-l pl-4">
              <Checkbox
                checked={selectedCount === totalCount && totalCount > 0}
                onChange={() => onSelectAll()}
              />
              <span className="text-sm text-muted-foreground">
                {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
              </span>
            </div>

            {selectedCount > 0 && (
              <div className="flex items-center gap-2 border-l pl-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <StopCircle className="h-4 w-4" />
                      Cancel Selected ({selectedCount})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Selected Sessions</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel {selectedCount} selected session{selectedCount > 1 ? 's' : ''}? 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onCancelSelected}>
                        Confirm Cancellation
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPaused && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Queue Paused</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}