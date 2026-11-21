
import React, { useEffect, useState } from 'react';

export default function ActivityImageUpload({
  id,
  file,
  onFileChange,
  existingImage = null
}) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const image = preview || existingImage;

  const handleChange = (event) => {
    const selected = event.target.files?.[0];

    if (!selected) return;

    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(
        selected.type
      )
    ) {
      alert('Only JPG, PNG, or WebP images are allowed.');
      event.target.value = '';
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      alert('Image must not exceed 5 MB.');
      event.target.value = '';
      return;
    }

    onFileChange(selected);
  };

  return (
    <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontWeight: 600,
          marginBottom: 8
        }}
      >
        Activity Image
      </label>

      <label
        htmlFor={id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
          minHeight: 135,
          padding: 16,
          border: '2px dashed #bfdbfe',
          borderRadius: 12,
          background: '#f8fbff',
          cursor: 'pointer',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >
        {image ? (
          <img
            src={image}
            alt="Activity preview"
            style={{
              width: '100%',
              maxHeight: 180,
              objectFit: 'cover',
              borderRadius: 9
            }}
          />
        ) : (
          <span style={{ fontSize: 30 }}>🖼️</span>
        )}

        <strong style={{ color: '#1d4ed8', fontSize: 14 }}>
          {file
            ? 'Change selected image'
            : existingImage
              ? 'Replace activity image'
              : 'Click to upload activity image'}
        </strong>

        <span style={{ fontSize: 12, color: '#64748b' }}>
          JPG, PNG or WebP · Maximum 5 MB
        </span>
      </label>

      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0
        }}
      />
    </div>
  );
}
