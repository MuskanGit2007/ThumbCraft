const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || body.message || message;
    } catch { /* response did not contain JSON */ }
    throw new Error(message);
  }
  return response.json();
}

// Uploads the creator's photo and returns the hosted image URL.
export async function uploadHeadshot(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request(`${API_BASE}/upload_headshot`, {
    method: 'POST',
    body: formData,
  });
}

// Keep the API's existing field names as defined by the supplied backend.
export async function createJob({ prompt, numThumbnails, headshotUrl }) {
  return request(`${API_BASE}/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      mum_thumbnails: numThumbnails,
      headshot_url: headshotUrl,
    }),
  });
}

export async function getJob(jobId) {
  return request(`${API_BASE}/job/${encodeURIComponent(jobId)}`);
}

export function subscribeToJob(jobId, callbacks = {}) {
  const stream = new EventSource(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/stream`);
  const parse = (event, callback) => {
    try { callback?.(JSON.parse(event.data)); }
    catch (error) { callbacks.onError?.(error); }
  };

  stream.addEventListener('thumbnail_redy', (event) => parse(event, callbacks.onThumbnailReady));
  // Accept the correctly-spelled event too, so the UI remains compatible if the API is corrected later.
  stream.addEventListener('thumbnail_ready', (event) => parse(event, callbacks.onThumbnailReady));
  stream.addEventListener('thumbnail_failed', (event) => parse(event, callbacks.onThumbnailFailed));
  stream.addEventListener('job_completed', (event) => {
    parse(event, callbacks.onThumbnailComplete);
    stream.close();
  });
  stream.onerror = (event) => callbacks.onError?.(event);
  return stream;
}
