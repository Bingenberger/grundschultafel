'use client';

import { useState, useEffect } from 'react';
import { useWhiteboardStore } from '@/store/useWhiteboardStore';
import { Check, X, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function JournalImagePicker({ onClose }: { onClose: () => void }) {
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { journalImages, setJournalImages } = useWhiteboardStore();

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const res = await fetch('/api/journal');
        const data = await res.json();
        if (data.images) {
          setImages(data.images);
        } else if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        setError('Konnte Bilder nicht laden.');
      } finally {
        setLoading(false);
      }
    };
    fetchImages();
  }, []);

  const handleToggleImage = (url: string) => {
    setSelectedImages((current) =>
      current.includes(url)
        ? current.filter((item) => item !== url)
        : [...current, url]
    );
  };

  const handleAddSelectedImages = () => {
    if (selectedImages.length === 0) return;

    setJournalImages([
      ...journalImages,
      ...selectedImages.map((url) => ({ id: uuidv4(), url })),
    ]);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--surface)',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        borderRadius: '24px',
        padding: '30px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ImageIcon size={32} color="var(--primary)" />
            Journal Bild auswählen
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--foreground)', padding: '8px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--background)'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {!loading && !error && images.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '10px 14px',
            borderRadius: '14px',
            background: 'var(--background)'
          }}>
            <div style={{ color: 'var(--foreground)', opacity: 0.8, fontSize: '0.98rem' }}>
              {selectedImages.length === 0
                ? 'Ein oder mehrere Bilder auswahlen'
                : `${selectedImages.length} Bild${selectedImages.length === 1 ? '' : 'er'} ausgewahlt`}
            </div>
            <button
              onClick={handleAddSelectedImages}
              disabled={selectedImages.length === 0}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '10px 16px',
                background: selectedImages.length === 0 ? 'rgba(0,0,0,0.12)' : 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                cursor: selectedImages.length === 0 ? 'default' : 'pointer',
                opacity: selectedImages.length === 0 ? 0.6 : 1
              }}
            >
              Hinzufugen
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', minHeight: '300px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--foreground)' }}>
              Lädt Bilder...
            </div>
          ) : error ? (
            <div style={{ color: 'var(--destructive)', textAlign: 'center', padding: '20px' }}>
              {error}
            </div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--foreground)' }}>
              Keine Bilder im Ordner <strong>public/assets/journal</strong> gefunden.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '16px'
            }}>
              {images.map((url, i) => (
                <div 
                  key={i}
                  onClick={() => handleToggleImage(url)}
                  style={{
                    aspectRatio: '3 / 2',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: selectedImages.includes(url) ? '2px solid var(--primary)' : '2px solid transparent',
                    transition: 'all 0.2s',
                    boxShadow: selectedImages.includes(url)
                      ? '0 10px 24px rgba(0,0,0,0.16)'
                      : '0 4px 12px rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    if (!selectedImages.includes(url)) {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    if (!selectedImages.includes(url)) {
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <img src={url} alt={`Journal ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {selectedImages.includes(url) && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 14px rgba(0,0,0,0.18)'
                    }}>
                      <Check size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
