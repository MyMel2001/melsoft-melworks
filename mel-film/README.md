# MelFilm

MelFilm - Professional Video Editing Studio powered by FFMPEG.

## Features
- Open video files (mp4, webm, mov).
- Render/export video via FFMPEG (resolution scaling, format conversion, fps control).
- Capture poster frames from video timelines.

## Commands
- `npm start` - launch Electron app.
- `npm test` - run automated FFMPEG engine checks (generates synthetic sources via lavfi).
- `npm run serve` - static web server for UI.

## Dependencies
- electron ^45.1.0
- ffmpeg binary on PATH.
