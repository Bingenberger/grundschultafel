'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ImagePlus, Upload, ChevronLeft, ChevronRight, Tags, Folder, Globe } from 'lucide-react';

interface GalleryItem {
  id: number;
  description: string;
  tags: string[];
  style: string | null;
  width: number | null;
  height: number | null;
  license: string;
  thumbnailUrl: string;
  displayUrl: string;
}

interface GalleryResponse {
  items: GalleryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface LocalFolder {
  name: string;
  images: string[];
}

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  onUploadCustom: () => void;
}

export default function GalleryModal({ isOpen, onClose, onSelectImage, onUploadCustom }: GalleryModalProps) {
  const [pixItems, setPixItems] = useState<GalleryItem[]>([]);
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [activeSource, setActiveSource] = useState<string>('pix');
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingPix, setLoadingPix] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.name === activeSource) || null,
    [folders, activeSource]
  );

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [isOpen, activeSource]);

  useEffect(() => {
    if (!isOpen || activeSource !== 'pix') return;

    const timeout = window.setTimeout(() => {
      setPage(1);
      setQuery(inputValue.trim());
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [inputValue, isOpen, activeSource]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    setLoadingFolders(true);

    fetch('/api/gallery/folders')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Ordner konnten nicht geladen werden');
        }
        return res.json() as Promise<{ folders: LocalFolder[] }>;
      })
      .then((data) => {
        if (isCancelled) return;
        setFolders(data.folders || []);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error(err);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingFolders(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeSource !== 'pix') return;

    let isCancelled = false;
    setLoadingPix(true);
    setError(null);

    const tagParam = activeTags.length ? `&tags=${encodeURIComponent(activeTags.join(','))}` : '';
    fetch(`/api/gallery?q=${encodeURIComponent(query)}${tagParam}&page=${page}&pageSize=36`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Galerie konnte nicht geladen werden');
        }
        return res.json() as Promise<GalleryResponse>;
      })
      .then((data) => {
        if (isCancelled) return;
        setPixItems(data.items || []);
        setTotalPages(Math.max(1, data.totalPages || 1));
        setTotal(data.total || 0);
        // Server clamps the page; follow it when the result shrank (e.g. a new filter)
        if (data.page && data.totalPages && page > data.totalPages) setPage(data.totalPages);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error(err);
        setError('Die Bildergalerie konnte nicht geladen werden.');
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingPix(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, query, page, activeSource, activeTags]);

  const addTag = (tag: string) => {
    setActiveTags((current) => (current.includes(tag) ? current : [...current, tag].slice(0, 5)));
    setPage(1);
  };
  const removeTag = (tag: string) => {
    setActiveTags((current) => current.filter((t) => t !== tag));
    setPage(1);
  };

  if (!isOpen) return null;

  const canGoBack = page > 1;
  const canGoForward = page < totalPages;
  const isPixMode = activeSource === 'pix';
  const localImages = activeFolder?.images || [];
  const licenseNote = pixItems.find((item) => item.license)?.license || '';

  return (
    <div
      data-gallery-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div style={{
        background: 'var(--surface)',
        borderRadius: '24px',
        display: 'flex',
        width: '95vw',
        height: '95vh',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid var(--border)',
        margin: 'auto'
      }}>
        <div style={{
          width: '290px',
          background: 'var(--background)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '20px'
        }}>
          <div style={{ padding: '0 18px 14px' }}>
            <h3 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.05rem' }}>Bildquellen</h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => setActiveSource('pix')}
              style={sourceButtonStyle(activeSource === 'pix')}
            >
              <Globe size={18} />
              Bildergalerie
            </button>

            {loadingFolders ? (
              <div style={{ padding: '12px 14px', color: 'var(--foreground)', opacity: 0.65 }}>Lade Ordner...</div>
            ) : folders.length === 0 ? (
              <div style={{ padding: '12px 14px', color: 'var(--foreground)', opacity: 0.65 }}>Keine lokalen Ordner gefunden</div>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.name}
                  onClick={() => setActiveSource(folder.name)}
                  style={sourceButtonStyle(activeSource === folder.name)}
                >
                  <Folder size={18} />
                  {folder.name.replace(/_/g, ' ')}
                </button>
              ))
            )}
          </div>

          <div style={{ padding: '18px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={onUploadCustom}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                background: 'var(--foreground)',
                color: 'var(--background)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              <Upload size={18} />
              Eigenes Bild
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '14px',
                background: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ImagePlus size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.25rem' }}>
                  {isPixMode ? 'Bildergalerie' : activeFolder?.name.replace(/_/g, ' ') || 'Bilder'}
                </h2>
                <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', opacity: 0.72 }}>
                  {isPixMode
                    ? query || activeTags.length ? `${total} Treffer` : `${total} Bilder in der Bildergalerie`
                    : `${localImages.length} lokale Bilder`}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', padding: '5px' }}
            >
              <X size={28} />
            </button>
          </div>

          {isPixMode ? (
            <div style={{
              padding: '16px 22px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                flex: '1 1 340px',
                minWidth: '260px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 14px',
                height: '48px',
                borderRadius: '14px',
                background: 'var(--background)',
                border: '1px solid var(--border)'
              }}>
                <Search size={18} color="var(--foreground)" />
                <input
                  ref={searchInputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Suche nach Schlagwort, Beschreibung oder Stil"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--foreground)',
                    fontSize: '1rem'
                  }}
                />
              </div>

              {activeTags.length ? (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {activeTags.map((tag) => (
                    <button key={tag} onClick={() => removeTag(tag)} style={activeTagStyle} title="Filter entfernen">
                      {tag} <X size={12} />
                    </button>
                  ))}
                </div>
              ) : null}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <button
                  onClick={() => canGoBack && setPage((current) => current - 1)}
                  disabled={!canGoBack}
                  style={pagerButtonStyle(!canGoBack)}
                  title="Vorherige Seite"
                >
                  <ChevronLeft size={18} />
                </button>
                <div style={{ minWidth: '92px', textAlign: 'center', color: 'var(--foreground)', fontSize: '0.92rem' }}>
                  Seite {page} / {totalPages}
                </div>
                <button
                  onClick={() => canGoForward && setPage((current) => current + 1)}
                  disabled={!canGoForward}
                  style={pagerButtonStyle(!canGoForward)}
                  title="Nächste Seite"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : null}

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            // Rows as tall as their cards; otherwise the fixed-height scroll area squeezes them
            gridAutoRows: 'max-content',
            gap: '18px',
            alignContent: 'start'
          }}>
            {isPixMode ? (
              loadingPix ? (
                <div style={messageStyle}>Lade Galerie...</div>
              ) : error ? (
                <div style={messageStyle}>{error}</div>
              ) : pixItems.length === 0 ? (
                <div style={messageStyle}>Keine passenden Bilder gefunden.</div>
              ) : (
                pixItems.map((item) => (
                  <button
                    key={`pix-${item.id}`}
                    data-gallery-item={item.id}
                    onClick={() => {
                      onSelectImage(item.displayUrl);
                      onClose();
                    }}
                    style={cardStyle}
                    onMouseEnter={cardMouseEnter}
                    onMouseLeave={cardMouseLeave}
                    title="Bild einfügen"
                  >
                    <div style={previewStyle}>
                      <img
                        src={item.thumbnailUrl}
                        alt={item.description || `Bild ${item.id}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center center', display: 'block', margin: 'auto' }}
                        draggable={false}
                      />
                    </div>

                    <div style={{ padding: '12px 12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={titleStyle}>
                        {item.tags[0] || item.description?.trim() || `Bild ${item.id}`}
                      </div>
                      <div style={descriptionStyle}>
                        {item.description?.trim() || ' '}
                      </div>
                      <div style={tagLineStyle}>
                        <Tags size={14} />
                        {item.tags.length ? (
                          <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', overflow: 'hidden', maxHeight: '22px' }}>
                            {item.tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                role="button"
                                tabIndex={0}
                                data-gallery-tag={tag}
                                onClick={(e) => { e.stopPropagation(); addTag(tag); }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); addTag(tag); }
                                }}
                                style={tagChipStyle}
                                title={`Nach „${tag}“ filtern`}
                              >
                                {tag}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span style={tagTextStyle}>Keine Schlagworte</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )
            ) : localImages.length === 0 ? (
              <div style={messageStyle}>Dieser Ordner ist leer.</div>
            ) : (
              localImages.map((imageUrl) => (
                <button
                  key={imageUrl}
                  onClick={() => {
                    onSelectImage(imageUrl);
                    onClose();
                  }}
                  style={cardStyle}
                  onMouseEnter={cardMouseEnter}
                  onMouseLeave={cardMouseLeave}
                  title="Bild einfügen"
                >
                  <div style={previewStyle}>
                    <img
                      src={imageUrl}
                      alt={imageUrl}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center center', display: 'block', margin: 'auto' }}
                      draggable={false}
                    />
                  </div>
                </button>
              ))
            )}
          </div>
          {isPixMode && licenseNote ? (
            <div style={{ padding: '10px 22px', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--foreground)', opacity: 0.72 }}>
              Lizenz: {licenseNote}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function sourceButtonStyle(active: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? 'white' : 'var(--foreground)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontWeight: active ? 700 : 500,
    transition: 'background 0.2s'
  } as const;
}

function pagerButtonStyle(disabled: boolean) {
  return {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: disabled ? 'rgba(0,0,0,0.04)' : 'var(--background)',
    color: 'var(--foreground)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } as const;
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  padding: 0,
  border: '1px solid var(--border)',
  borderRadius: '16px',
  overflow: 'hidden',
  background: 'var(--surface)',
  cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease'
};

const previewStyle: React.CSSProperties = {
  aspectRatio: '1',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px'
};

const titleStyle: React.CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 700,
  fontSize: '0.92rem',
  lineHeight: 1.2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const descriptionStyle: React.CSSProperties = {
  color: 'var(--foreground)',
  opacity: 0.66,
  fontSize: '0.78rem',
  lineHeight: 1.25,
  minHeight: '2.1em',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
};

const tagLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: 'var(--foreground)',
  opacity: 0.72,
  fontSize: '0.76rem',
  minHeight: '18px'
};

const tagTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const tagChipStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  borderRadius: '999px',
  padding: '1px 8px',
  fontSize: '0.72rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const activeTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  border: 'none',
  background: 'var(--primary)',
  color: 'white',
  borderRadius: '999px',
  padding: '6px 10px',
  fontSize: '0.85rem',
  cursor: 'pointer'
};

const messageStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  textAlign: 'center',
  color: 'var(--foreground)',
  opacity: 0.7,
  padding: '48px 0'
};

function cardMouseEnter(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = 'translateY(-2px)';
  e.currentTarget.style.borderColor = 'var(--primary)';
  e.currentTarget.style.boxShadow = '0 14px 28px rgba(15,23,42,0.14)';
}

function cardMouseLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = 'translateY(0)';
  e.currentTarget.style.borderColor = 'var(--border)';
  e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.08)';
}
