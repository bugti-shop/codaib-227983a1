// CSS styles for the RichTextEditor
// Extracted from inline <style> tag in RichTextEditor.tsx

export const RICH_TEXT_EDITOR_STYLES = `
  .rich-text-editor a {
    color: #3B82F6;
    text-decoration: underline;
  }
  .rich-text-editor ul {
    list-style: disc;
    padding-left: 2rem;
  }
  .rich-text-editor ul.checklist {
    list-style: none;
    padding-left: 0.5rem;
  }
  .rich-text-editor .checklist-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.25rem 0;
    min-height: 1.5rem;
  }
  .rich-text-editor .checklist-checkbox {
    width: 18px;
    height: 18px;
    margin-top: 0.15rem;
    accent-color: hsl(var(--primary));
    cursor: pointer;
    flex-shrink: 0;
  }
  .rich-text-editor .checklist-text {
    flex: 1;
    min-width: 0;
  }
  .rich-text-editor .checklist-item.checked .checklist-text {
    text-decoration: line-through;
    opacity: 0.6;
  }
  .rich-text-editor ol {
    list-style: decimal;
    padding-left: 2rem;
  }
  /* Solid black separator/horizontal rule */
  .rich-text-editor hr {
    border: none;
    border-top: 2px solid #000000 !important;
    margin: 16px 0;
  }
  /* MS Word style page break container */
  .rich-text-editor .page-break-container {
    page-break-after: always;
    margin: 32px 0;
    position: relative;
    user-select: none;
  }
  /* Ensure smooth mobile scrolling inside the editor */
  .rich-text-editor__scroll {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }
  .title-input {
    font-size: 1.5rem;
    font-weight: bold;
    border: none;
    outline: none;
    background: transparent;
    width: 100%;
    padding: 1rem 1rem 0.5rem 1rem;
  }
  .title-input::placeholder {
    color: rgba(0, 0, 0, 0.3);
  }
  /* Sticky note title should be black */
  .sticky-note-editor .title-input {
    color: #000000 !important;
  }
  /* Enhanced audio player styling */
  .audio-player-container {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    padding: 12px;
  }
  .audio-player-container audio {
    width: 100%;
    height: 54px;
    border-radius: 8px;
  }
  .audio-player-container audio::-webkit-media-controls-panel {
    background: transparent;
  }
  /* Inline voice recording styles - WhatsApp style */
  .voice-recording-inline {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    margin: 8px 0;
    background: hsl(var(--muted) / 0.5);
    border-radius: 18px;
    border: 1px solid hsl(var(--border) / 0.3);
    user-select: none;
    max-width: 320px;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .voice-recording-inline audio {
    display: none;
  }
  .voice-recording-inline .voice-play-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.15s, background 0.15s;
    pointer-events: auto;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .voice-recording-inline .voice-play-btn:hover {
    background: hsl(var(--primary) / 0.9);
  }
  .voice-recording-inline .voice-play-btn:active {
    transform: scale(0.92);
  }
  .voice-recording-inline .voice-play-btn svg {
    margin-left: 2px;
    pointer-events: none;
  }
  .voice-recording-inline .voice-play-btn .pause-icon {
    margin-left: 0;
  }
  .voice-recording-inline .voice-waveform {
    flex: 1;
    position: relative;
    height: 28px;
    display: flex;
    align-items: center;
    min-width: 100px;
    cursor: pointer;
    padding: 4px 0;
    border-radius: 4px;
    transition: background 0.15s;
    pointer-events: auto;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .voice-recording-inline .voice-waveform:hover {
    background: hsl(var(--muted-foreground) / 0.08);
  }
  .voice-recording-inline .voice-waveform:active {
    background: hsl(var(--muted-foreground) / 0.12);
  }
  .voice-recording-inline .waveform-background {
    position: relative;
    z-index: 1;
    pointer-events: none;
  }
  .voice-recording-inline .waveform-progress {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }
  .voice-recording-inline .voice-duration {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    min-width: 38px;
    text-align: right;
    flex-shrink: 0;
    pointer-events: none;
  }
  .voice-recording-inline .voice-delete-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    color: hsl(var(--destructive));
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0.6;
    transition: opacity 0.15s, background 0.15s;
    pointer-events: auto;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .voice-recording-inline .voice-delete-btn:hover {
    opacity: 1;
    background: hsl(var(--destructive) / 0.1);
  }
  .voice-recording-inline .voice-delete-btn svg {
    pointer-events: none;
  }
  .voice-recording-inline .voice-speed-btn {
    min-width: 40px;
    height: 28px;
    padding: 0 8px;
    border-radius: 14px;
    background: hsl(var(--muted-foreground) / 0.15);
    color: hsl(var(--foreground));
    font-size: 12px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.1s;
    pointer-events: auto;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .voice-recording-inline .voice-speed-btn:hover {
    background: hsl(var(--muted-foreground) / 0.25);
  }
  .voice-recording-inline .voice-speed-btn:active {
    transform: scale(0.95);
  }
  /* Print styles for page breaks */
  @media print {
    .rich-text-editor .page-break-container {
      page-break-after: always;
      break-after: page;
    }
    .voice-recording-inline {
      display: none;
    }
  }
`;
