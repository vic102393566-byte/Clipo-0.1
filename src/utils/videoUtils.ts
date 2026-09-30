export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds <= 0) return '0:30';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const parseDurationToSeconds = (durationStr?: string): number => {
  if (!durationStr) return 180; // default 3 min
  const parts = durationStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 180;
};

export const isValidVideoFile = (file: File): boolean => {
  const allowedExtensions = ['.mp4', '.mov', '.webm'];
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
  const lowerName = file.name.toLowerCase();

  const hasValidExt = allowedExtensions.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = allowedTypes.includes(file.type);

  return hasValidExt || hasValidMime;
};

export const extractVideoMetadata = async (
  file: File
): Promise<{ duration: string; thumbnail: string; objectUrl: string }> => {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;

    // Fallback if loading metadata hangs
    const timeout = setTimeout(() => {
      resolve({
        duration: '0:45',
        thumbnail: '',
        objectUrl,
      });
    }, 4000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1.0, (video.duration || 1) / 2);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.85);
          resolve({
            duration: formatDuration(video.duration),
            thumbnail,
            objectUrl,
          });
          return;
        }
      } catch (err) {
        console.warn('Canvas export failed, using fallback:', err);
      }
      resolve({
        duration: formatDuration(video.duration),
        thumbnail: '',
        objectUrl,
      });
    };

    video.onerror = () => {
      clearTimeout(timeout);
      resolve({
        duration: '0:45',
        thumbnail: '',
        objectUrl,
      });
    };
  });
};
