'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MobileUploadPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Extract token from URL search params
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setStatus('error');
      setErrorMessage('Kein gültiger Verbindungs-Code gefunden.');
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setStatus('uploading');

    const formData = new FormData();
    formData.append('token', token);
    formData.append('image', file);

    try {
      const res = await fetch('/api/mobile-upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload fehlgeschlagen');
      }

      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Ein Fehler ist aufgetreten.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '24px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#1e293b', marginBottom: '10px' }}>Tafel-Upload</h1>
        <p style={{ color: '#64748b', marginBottom: '30px', fontSize: '1.1rem' }}>
          Sende ein Foto direkt auf die interaktive Tafel.
        </p>

        {status === 'idle' && token && (
          <>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" // Suggests back camera on mobile
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
                transition: 'transform 0.1s'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Camera size={48} />
              <span>Foto aufnehmen</span>
            </button>
          </>
        )}

        {status === 'uploading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', color: '#3b82f6' }}>
            <UploadCloud size={48} className="animate-bounce" />
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Wird gesendet...</span>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', color: '#10b981' }}>
            <CheckCircle2 size={64} />
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Foto erfolgreich gesendet!</span>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '10px' }}>
              Du kannst diesen Tab nun schließen oder ein weiteres Foto machen.
            </p>
            <button
              onClick={() => {
                setStatus('idle');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              style={{
                marginTop: '15px',
                padding: '12px 24px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Noch ein Foto
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', color: '#ef4444' }}>
            <AlertCircle size={48} />
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Fehler</span>
            <span style={{ color: '#ef4444' }}>{errorMessage}</span>
            <button
              onClick={() => setStatus('idle')}
              style={{
                marginTop: '15px',
                padding: '12px 24px',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Erneut versuchen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
