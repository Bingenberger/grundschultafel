'use client';

import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import JournalImagePicker from './JournalImagePicker';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Item Component ---
function SortableImageItem({
  item,
  isActive,
  onActivate,
  onRemove,
}: {
  item: { id: string, url: string },
  isActive: boolean,
  onActivate: (id: string) => void,
  onRemove: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      data-journal-card="true"
      onPointerDown={() => onActivate(item.id)}
      style={{
        ...style,
        position: 'relative',
        width: '100%',
        aspectRatio: '3 / 2',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        backgroundColor: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default'
      }}
    >
      <img 
        src={item.url} 
        alt="Ablauf" 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        draggable={false}
      />
      
      {/* Drag Handle */}
      {isActive && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            backgroundColor: 'rgba(255,255,255,0.45)',
            borderRadius: '50%',
            padding: '2px',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0,0,0,0.38)',
            backdropFilter: 'blur(2px)'
          }}
        >
          <GripVertical size={15} />
        </div>
      )}

      {/* Delete Button */}
      {isActive && (
        <button
          onClick={() => onRemove(item.id)}
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            backgroundColor: 'rgba(244, 67, 54, 0.9)',
            border: 'none',
            borderRadius: '50%',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}
          title="Entfernen"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

// --- Main Sidebar Component ---
export default function JournalSidebar() {
  const { isJournalOpen, journalImages, setJournalImages } = useWhiteboardStore();
  const [showPicker, setShowPicker] = useState(false);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!sidebarRef.current?.contains(event.target as Node)) {
        setActiveImageId(null);
        return;
      }

      const element = event.target as HTMLElement | null;
      if (!element?.closest('[data-journal-card="true"]')) {
        setActiveImageId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  if (!isJournalOpen) return null;

  const now = new Date();
  const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const dayName = weekdays[now.getDay()];
  const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = journalImages.findIndex((item) => item.id === active.id);
      const newIndex = journalImages.findIndex((item) => item.id === over.id);
      setJournalImages(arrayMove(journalImages, oldIndex, newIndex));
    }
  };

  const handleRemove = (id: string) => {
    setJournalImages(journalImages.filter(item => item.id !== id));
    setActiveImageId((current) => (current === id ? null : current));
  };

  return (
    <div
      ref={sidebarRef}
      style={{
        width: '184px',
        height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 90,
        flexShrink: 0,
        transition: 'width 0.3s ease'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 10px',
        borderBottom: '1px solid var(--border)',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.45rem', color: 'var(--primary)', fontWeight: 'bold', lineHeight: 1.1 }}>
          {dayName}
        </h2>
        <div style={{ fontSize: '0.95rem', color: 'var(--foreground)', opacity: 0.8, marginTop: '2px', lineHeight: 1.1 }}>
          {dateStr}
        </div>
      </div>

      {/* Image List (Sortable via dnd-kit) */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={journalImages.map(img => img.id)}
            strategy={verticalListSortingStrategy}
          >
            {journalImages.map((item) => (
              <SortableImageItem
                key={item.id}
                item={item}
                isActive={activeImageId === item.id}
                onActivate={setActiveImageId}
                onRemove={handleRemove}
              />
            ))}
          </SortableContext>
        </DndContext>

        {journalImages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--foreground)', opacity: 0.6, marginTop: '40px' }}>
            Noch keine Bilder eingefügt.
          </div>
        )}
      </div>

      {/* Bottom Plus Button */}
      <div style={{
        padding: '10px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => setShowPicker(true)}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'transform 0.1s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="Bild hinzufügen"
        >
          <Plus size={17} />
        </button>
      </div>

      {/* Picker Modal Overlay */}
      {showPicker && (
        <JournalImagePicker onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}
