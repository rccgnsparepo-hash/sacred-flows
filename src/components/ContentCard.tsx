import { Link } from '@tanstack/react-router';
import { FileText, Play, Bookmark, BookmarkCheck } from 'lucide-react';

interface ContentCardProps {
  id: string;
  title: string;
  description: string | null;
  type: 'PDF' | 'YOUTUBE';
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export function ContentCard({ id, title, description, type, isBookmarked, onToggleBookmark }: ContentCardProps) {
  return (
    <div className="neu-card p-5 slide-up">
      <div className="flex items-start justify-between gap-3">
        <Link to="/content/$id" params={{ id }} className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className={`neu-btn p-2.5 ${type === 'PDF' ? 'text-primary' : 'text-church-gold'}`}>
              {type === 'PDF' ? <FileText size={18} /> : <Play size={18} />}
            </div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${
              type === 'PDF' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-church-gold/15 text-church-gold'
            }`}>
              {type === 'PDF' ? 'PDF' : 'Video'}
            </span>
          </div>
          <h3 className="font-semibold text-foreground text-[15px] leading-snug mb-1 line-clamp-2">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-[13px] line-clamp-2 leading-relaxed">{description}</p>
          )}
        </Link>
        {onToggleBookmark && (
          <button
            onClick={(e) => { e.preventDefault(); onToggleBookmark(); }}
            className="neu-btn p-2 mt-1 shrink-0"
          >
            {isBookmarked 
              ? <BookmarkCheck size={18} className="text-church-gold" /> 
              : <Bookmark size={18} className="text-muted-foreground" />
            }
          </button>
        )}
      </div>
    </div>
  );
}
