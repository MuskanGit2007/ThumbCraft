import { useEffect, useMemo, useRef, useState } from 'react';
import { createJob, getJob, subscribeToJob, uploadHeadshot } from './api.js';
import './App.css';

const examples = [
  { title: 'Tech review', prompt: 'A bold, high-energy YouTube thumbnail for a technology review. Make the subject expressive, use dramatic studio lighting, vivid blue and orange accents, and leave clean space for a short headline.' },
  { title: 'Educational', prompt: 'A clean and engaging educational YouTube thumbnail. Use a confident presenter, bright contrasting colors, simple visual symbols, and a clear focal point that feels trustworthy and easy to understand.' },
  { title: 'Podcast', prompt: 'A premium podcast thumbnail with cinematic lighting, rich dark tones, a close-up expressive portrait, subtle depth, and a modern editorial composition.' },
];

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/></>,
    grid: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.4-.5a8 8 0 0 1-1.7 1l-.2 1.5h-2.4l-.3-1.5a8 8 0 0 1-1.7-1l-1.4.5-1.2-2.1 1.2-.9a7 7 0 0 1 0-2l-1.2-.9 1.2-2.1 1.4.5a8 8 0 0 1 1.7-1l.3-1.5h2.4l.2 1.5a8 8 0 0 1 1.7 1l1.4-.5 1.2 2.1-1.2.9a7 7 0 0 1 0 2Z" transform="translate(-1 -1)"/></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 17v3h16v-3"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    wand: <><path d="m15 4 5 5M4 20 18 6M7 4v4M5 6h4M18 15v5m-2.5-2.5h5"/></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/></>,
  };
  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(3);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const streamRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => () => {
    streamRef.current?.close();
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const thumbnails = useMemo(() => job?.thumbnails || [], [job]);
  const completed = thumbnails.filter((item) => ['uploaded', 'ready', 'complete', 'completed'].includes(String(item.status).toLowerCase())).length;
  const failed = thumbnails.filter((item) => ['failed', 'error'].includes(String(item.status).toLowerCase())).length;
  const progress = thumbnails.length ? Math.round(((completed + failed) / thumbnails.length) * 100) : 0;

  function selectFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (nextFile.size > 10 * 1024 * 1024) { setError('Image must be smaller than 10 MB.'); return; }
    setError('');
    setFile(nextFile);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(nextFile); });
  }

  async function refreshJob(id) {
    try {
      const latest = await getJob(id);
      setJob(latest);
      const allFinished = (latest.thumbnails || []).length > 0 && latest.thumbnails.every((item) => ['uploaded', 'ready', 'complete', 'completed', 'failed', 'error'].includes(String(item.status).toLowerCase()));
      if (allFinished) {
        setBusy(false);
        streamRef.current?.close();
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    } catch (err) {
      // Keep the live stream active; polling errors can be temporary while a job starts.
      console.warn('Unable to refresh job:', err.message);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (!file) { setError('Upload a photo before generating thumbnails.'); return; }
    if (!prompt.trim()) { setError('Add a prompt describing the thumbnail you want.'); return; }
    setError(''); setBusy(true); setJob(null); setJobId('');
    streamRef.current?.close();
    if (pollRef.current) window.clearInterval(pollRef.current);
    try {
      const uploaded = await uploadHeadshot(file);
      const created = await createJob({ prompt: prompt.trim(), numThumbnails: count, headshotUrl: uploaded.url });
      const id = created.job_id || created.id;
      if (!id) throw new Error('The API did not return a job ID.');
      setJobId(id);
      setActiveTab('results');
      await refreshJob(id);
      streamRef.current = subscribeToJob(id, {
        onThumbnailReady: () => refreshJob(id),
        onThumbnailFailed: () => refreshJob(id),
        onThumbnailComplete: () => refreshJob(id),
        onError: () => refreshJob(id),
      });
      pollRef.current = window.setInterval(() => refreshJob(id), 2500);
    } catch (err) {
      setBusy(false);
      setError(err.message || 'Something went wrong. Please try again.');
    }
  }

  function resetForm() {
    setJob(null); setJobId(''); setActiveTab('create'); setBusy(false); setError('');
    streamRef.current?.close();
    if (pollRef.current) window.clearInterval(pollRef.current);
  }

  function downloadImage(url, name) {
    if (!url) return;
    const link = document.createElement('a'); link.href = url; link.download = name || 'thumbnail'; link.target = '_blank'; link.rel = 'noreferrer'; link.click();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={resetForm}>
          <span className="brand-mark"><Icon name="spark" size={22}/></span>
          <span>thumb<span className="brand-accent">craft</span><small>AI STUDIO</small></span>
        </a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={`nav-item ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}><Icon name="wand"/> Create thumbnail</button>
          <button className={`nav-item ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}><Icon name="grid"/> My generations {job && <span className="nav-count">1</span>}</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="tip-icon"><Icon name="spark"/></div><strong>Make every view count.</strong><p>Great thumbnails turn a scroll into a click.</p></div>
          <div className="profile-row"><div className="avatar">M</div><div><strong>Creator workspace</strong><span>Personal studio</span></div><button className="more-btn" aria-label="More options">···</button></div>
        </div>
      </aside>

      <main className="main-area" id="home">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{activeTab === 'create' ? 'Create' : 'Generations'}</b></div><div className="topbar-right"><span className="status-pill"><i/> All systems ready</span><div className="top-avatar">M</div></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR CREATIVE EDGE</div><h1>{activeTab === 'create' ? <>Turn ideas into<br/><em>click-worthy</em> thumbnails.</> : <>Your creative<br/><em>generations.</em></>}</h1><p className="page-subtitle">Create scroll-stopping YouTube visuals in seconds, powered by AI.</p></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-card art-back"><span>MAKE IT</span><b>POP.</b></div><div className="art-card art-front"><Icon name="spark" size={27}/><span>CREATIVE<br/>MODE</span></div><div className="art-star">✳</div></div></section>

          {activeTab === 'create' ? (
            <form className="workspace-grid" onSubmit={handleGenerate}>
              <section className="panel input-panel">
                <div className="panel-heading"><div className="step-number">01</div><div><h2>Start with your image</h2><p>Upload a clear photo of yourself or your subject.</p></div><span className="optional-tag">REQUIRED</span></div>
                <div className={`upload-zone ${dragging ? 'dragging' : ''} ${preview ? 'has-image' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files?.[0]); }} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click(); }}>
                  <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => selectFile(e.target.files?.[0])}/>
                  {preview ? <><img className="upload-preview" src={preview} alt="Selected upload preview"/><div className="preview-overlay"><span><Icon name="refresh" size={15}/> Change photo</span></div><button className="remove-image" type="button" aria-label="Remove image" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview((old) => { if (old) URL.revokeObjectURL(old); return ''; }); }}><Icon name="close" size={15}/></button></> : <><div className="upload-icon"><Icon name="upload" size={23}/></div><strong>Drop your image here</strong><span>or <b>browse files</b> to upload</span><small>PNG, JPG or WEBP · Max 10 MB</small></>}
                </div>
                <div className="upload-foot"><span><Icon name="check" size={14}/> Your image stays yours</span><span>Best results: front-facing photo</span></div>
                <div className="section-divider"/>
                <div className="panel-heading prompt-heading"><div className="step-number">02</div><div><h2>Describe your thumbnail</h2><p>Tell the AI what you're imagining. Be as specific as you like.</p></div></div>
                <div className="prompt-wrap"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={700} placeholder="e.g. A high-energy thumbnail for my new coding tutorial. Put me on the right side with a surprised expression, a glowing laptop, bold purple and electric blue lighting..."/><div className="prompt-bottom"><span><Icon name="spark" size={14}/> Be descriptive for better results</span><span>{prompt.length}/700</span></div></div>
                <div className="examples-row"><span>TRY A STYLE</span>{examples.map((example) => <button type="button" key={example.title} className="example-chip" onClick={() => setPrompt(example.prompt)}>{example.title}</button>)}</div>
                <div className="section-divider"/>
                <div className="panel-heading quantity-heading"><div className="step-number">03</div><div><h2>How many variations?</h2><p>Explore different creative directions.</p></div></div>
                <div className="quantity-options">{[1, 2, 3].map((number) => <button type="button" key={number} className={`quantity-option ${count === number ? 'selected' : ''}`} onClick={() => setCount(number)}><span className="quantity-number">{number}</span><span><b>{number === 1 ? 'Just one' : `${number} variations`}</b><small>{number === 1 ? 'One focused concept' : number === 2 ? 'A couple of ideas' : 'More ideas to choose from'}</small></span>{count === number && <span className="selected-check"><Icon name="check" size={13}/></span>}</button>)}</div>
                {error && <div className="error-message"><Icon name="close" size={15}/>{error}</div>}
                <button className="generate-button" type="submit" disabled={busy}>{busy ? <><span className="button-spinner"/> Creating your thumbnails...</> : <><Icon name="spark" size={18}/> Generate thumbnails <Icon name="arrow" size={17}/></>}</button>
                <p className="disclaimer">Your creativity, amplified by AI. Generation may take a little while.</p>
              </section>

              <aside className="right-column">
                <section className="preview-panel"><div className="preview-top"><div><span className="mini-label">LIVE PREVIEW</span><h3>Your canvas</h3></div><span className="ratio-tag">16:9</span></div><div className="canvas-preview">{preview ? <img src={preview} alt="Your thumbnail subject"/> : <div className="canvas-placeholder"><div className="placeholder-sun"/><div className="placeholder-person"><div className="placeholder-head"/><div className="placeholder-body"/></div><div className="placeholder-copy"><span>YOUR</span><b>BIG IDEA</b></div><span className="placeholder-tag">THUMBNAIL PREVIEW</span></div>}<div className="canvas-play"><Icon name="video" size={17}/></div></div><div className="canvas-caption"><span><i/> YouTube thumbnail</span><span>1280 × 720 px</span></div></section>
                <section className="how-card"><div className="how-heading"><span className="how-icon"><Icon name="spark"/></span><div><h3>How it works</h3><p>Three steps to your next hit.</p></div></div><div className="how-step"><span>1</span><div><b>Upload your photo</b><p>Choose the face or subject to feature.</p></div></div><div className="how-step"><span>2</span><div><b>Describe your vision</b><p>Set the mood, style, and story.</p></div></div><div className="how-step"><span>3</span><div><b>Generate & download</b><p>Pick your favorite and share it.</p></div></div></section>
                <div className="pro-tip"><span>✦ CREATOR TIP</span><p>Faces with clear expressions and strong contrast often stand out in a crowded feed.</p></div>
              </aside>
            </form>
          ) : (
            <section className="results-section">
              <div className="results-toolbar"><div><h2>Generation results</h2><p>{jobId ? `Job ${jobId.slice(0, 8)} · ${completed} of ${thumbnails.length} ready` : 'Your generated thumbnails will appear here.'}</p></div><button className="secondary-button" onClick={resetForm}><Icon name="spark" size={16}/> New generation</button></div>
              {jobId && busy && <div className="progress-card"><div className="progress-copy"><span><span className="live-dot"/> GENERATING YOUR IDEAS</span><b>{progress}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }}/></div><p>We're bringing your creative direction to life. This usually takes a short moment.</p></div>}
              {!jobId ? <div className="empty-state"><div className="empty-icon"><Icon name="image" size={28}/></div><h3>No generations yet</h3><p>Your finished thumbnails will show up here. Start by creating your first one.</p><button className="generate-button compact" onClick={() => setActiveTab('create')}>Create a thumbnail <Icon name="arrow" size={16}/></button></div> : <div className="results-grid">{thumbnails.map((item, index) => { const url = item.imagekit_url || item.imgekit_url || item.url || item.variants?.thumbnail || ''; const isFailed = ['failed', 'error'].includes(String(item.status).toLowerCase()); const isReady = !!url || ['uploaded', 'ready', 'complete', 'completed'].includes(String(item.status).toLowerCase()); return <article className="result-card" key={item.id || index}><div className="result-image">{url ? <img src={url} alt={`${item.style_name || 'Generated'} thumbnail`}/> : <div className="result-pending"><span className={isFailed ? 'failed-mark' : 'button-spinner'}/><b>{isFailed ? 'Generation failed' : 'Creating your design'}</b><small>{item.error_message || item.error || 'Your thumbnail is being prepared'}</small></div>}<span className={`result-status ${isReady ? 'ready' : ''}`}>{isReady ? 'READY' : String(item.status || 'PENDING').toUpperCase()}</span></div><div className="result-info"><div><b>{item.style_name || `Variation ${index + 1}`}</b><span>{isReady ? 'Your design is ready' : isFailed ? 'Generation failed' : 'Working on your design'}</span></div><button className="icon-button" disabled={!url} onClick={() => downloadImage(url, `thumbcraft-${index + 1}.jpg`)} aria-label="Download thumbnail"><Icon name="download"/></button></div></article>; })}</div>}
              {job && failed > 0 && <p className="results-note">{failed} variation(s) could not be generated. You can start a new generation and try again.</p>}
            </section>
          )}
          <footer className="footer"><span>© 2026 Thumbcraft Studio</span><span>Made for creators, with a little AI magic <b>✳</b></span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
