import './capture.js'; // must come first: virtual clock for video capture (?capture)
import './style.css';
import { createStage } from './stage.js';
import { createApp } from './app.js';

const stage = createStage(document.getElementById('view'));
createApp({ stage, root: document.body });
