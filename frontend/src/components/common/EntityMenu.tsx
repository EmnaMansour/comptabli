import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreVertical, 
  Share2, 
  Download, 
  Move, 
  Archive, 
  Trash2,
  Eye,
  ArchiveRestore,
  ExternalLink,
  Type
} from 'lucide-react';

export type EntityAction = 
  | 'share' 
  | 'download' 
  | 'rename' 
  | 'move' 
  | 'archive' 
  | 'unarchive'
  | 'delete' 
  | 'view' 
  | 'deactivate';

interface EntityMenuProps {
  onAction: (action: EntityAction) => void;
  actions: EntityAction[];
  entityName?: string;
}

export default function EntityMenu({ onAction, actions, entityName }: EntityMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: EntityAction) => {
    setIsOpen(false);
    onAction(action);
  };

  const actionMap: Record<EntityAction, { label: string; icon: React.ReactNode; className?: string }> = {
    view: { label: 'Aperçu', icon: <Eye size={18} strokeWidth={1.5} /> },
    share: { label: 'Partager', icon: <Share2 size={18} strokeWidth={1.5} /> },
    download: { label: 'Télécharger', icon: <Download size={18} strokeWidth={1.5} /> },
    rename: { label: 'Renommer', icon: <Type size={18} strokeWidth={1.5} /> },
    move: { label: 'Déplacer', icon: <Move size={18} strokeWidth={1.5} /> },
    archive: { label: 'Archiver', icon: <Archive size={18} strokeWidth={1.5} /> },
    unarchive: { label: 'Désarchiver', icon: <ArchiveRestore size={18} strokeWidth={1.5} /> },
    delete: { label: 'Supprimer', icon: <Trash2 size={18} strokeWidth={1.5} />, className: 'danger' },
    deactivate: { label: 'Désactiver', icon: <ExternalLink size={18} strokeWidth={1.5} />, className: 'danger' },
  };

  const toggleMenu = () => {
    void entityName;
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Si moins de 250px d'espace en bas, on ouvre vers le haut
      setOpenUp(spaceBelow < 250);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="ws-menu-wrap" ref={menuRef} onClick={e => e.stopPropagation()}>
      <button 
        ref={buttonRef}
        className="ws-folder-menu-btn" 
        style={{ background: 'transparent' }}
        onClick={toggleMenu}
        aria-label="Actions"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className={`ws-dropdown ${openUp ? 'up' : ''}`}>
          {actions.map(action => {
            const config = actionMap[action];
            return (
              <button 
                key={action}
                type="button" 
                className={config.className}
                onClick={() => handleAction(action)}
              >
                {config.icon}
                {config.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
