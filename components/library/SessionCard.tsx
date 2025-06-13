import { Session } from '@/src/models/Session';
import { Card } from '@/components/ui/Card';
import { Calendar, Clock, PlayCircle, CheckCircle, XCircle, AlertCircle, Pause } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SessionCardProps {
  session: Session;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Pending',
  },
  planning: {
    icon: AlertCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Planning',
  },
  validating: {
    icon: AlertCircle,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    label: 'Validating',
  },
  executing: {
    icon: PlayCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Executing',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-600/10',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Failed',
  },
  cancelled: {
    icon: Pause,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    label: 'Cancelled',
  },
  paused: {
    icon: Pause,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    label: 'Paused',
  },
};

export default function SessionCard({ session, viewMode, onClick }: SessionCardProps) {
  const status = statusConfig[session.status];
  const StatusIcon = status.icon;
  const progress = session.metadata?.progress?.percentage || 0;
  const isInProgress = ['planning', 'validating', 'executing'].includes(session.status);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (viewMode === 'list') {
    return (
      <Card
        hover
        onClick={onClick}
        className="p-4 cursor-pointer transition-all hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <div className={`p-2 rounded-lg ${status.bgColor}`}>
            <StatusIcon className={`w-5 h-5 ${status.color}`} />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{session.name}</h3>
                {session.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {session.description}
                  </p>
                )}
              </div>
              
              {/* Metadata */}
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}</span>
                </div>
                {session.metadata?.totalDuration && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(session.metadata.totalDuration)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {isInProgress && (
              <div className="mt-3">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className={`px-3 py-1.5 rounded-full ${status.bgColor} ${status.color} text-sm font-medium`}>
            {status.label}
          </div>
        </div>
      </Card>
    );
  }

  // Grid View
  return (
    <Card
      hover
      onClick={onClick}
      className="p-5 cursor-pointer transition-all hover:shadow-md h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`p-2 rounded-lg ${status.bgColor}`}>
          <StatusIcon className={`w-5 h-5 ${status.color}`} />
        </div>
        <div className={`px-2.5 py-1 rounded-full ${status.bgColor} ${status.color} text-xs font-medium`}>
          {status.label}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="font-semibold text-base mb-1 line-clamp-2">{session.name}</h3>
        {session.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {session.description}
          </p>
        )}
      </div>

      {/* Progress */}
      {isInProgress && (
        <div className="mt-3 mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}</span>
        </div>
        {session.metadata?.totalDuration && (
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(session.metadata.totalDuration)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}