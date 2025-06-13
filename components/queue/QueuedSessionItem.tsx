import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QueuedSession } from '@/src/services/queue/SessionQueueManager';
import { SessionPriority } from '@/src/models/Session';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  GripVertical, 
  Clock, 
  Hash, 
  MoreVertical,
  X,
  Play,
  Pause,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface QueuedSessionItemProps {
  session: QueuedSession;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onPriorityChange: (priority: SessionPriority) => void;
  onCancel: () => void;
  disableDrag?: boolean;
}

export function QueuedSessionItem({
  session,
  isSelected,
  onSelect,
  onPriorityChange,
  onCancel,
  disableDrag = false
}: QueuedSessionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: session.id,
    disabled: disableDrag
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors: Record<SessionPriority, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    critical: 'destructive',
    high: 'secondary',
    medium: 'secondary',
    low: 'outline'
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-4 w-4" />,
    executing: <Play className="h-4 w-4" />,
    paused: <Pause className="h-4 w-4" />,
    failed: <AlertTriangle className="h-4 w-4" />
  };

  const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`${isDragging ? 'shadow-lg' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {!disableDrag && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            <Checkbox
              checked={isSelected}
              onChange={onSelect}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{session.name}</h4>
                <Badge variant={priorityColors[session.priority]}>
                  {session.priority}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  {statusIcons[session.status]}
                  {session.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Position: {session.queuePosition}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Wait: ~{formatWaitTime(session.estimatedWaitTime)}
                </span>
                <span>
                  Added {formatDistanceToNow(session.addedToQueueAt, { addSuffix: true })}
                </span>
              </div>

              {session.objective && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {session.objective}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={session.priority}
                onChange={(e) => onPriorityChange(e.target.value as SessionPriority)}
                disabled={session.status !== 'pending'}
                className="w-24 h-8"
              >
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={onCancel}
                    className="text-destructive focus:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel Session
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}