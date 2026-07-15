chrome.commands.onCommand.addListener(async (command) => {
  if (command === "trigger-ai") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // The backend authenticates state-changing calls with a shared token.
    // Store it once via: chrome.storage.local.set({ kashinaiToken: '<token>' })
    const { kashinaiToken } = await chrome.storage.local.get('kashinaiToken');

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: processPage,
      args: [kashinaiToken || ''],
    });
  }
});

async function processPage(apiToken) {
  // 1. Clean up any existing popup HOST (the shadow root lives inside this)
  const oldHost = document.getElementById('kashinai-popup-host');
  if (oldHost) oldHost.remove();

  const selectedText = window.getSelection().toString().trim();

  const host = document.createElement('div');
  host.id = 'kashinai-popup-host';
  host.style.cssText = `
    all: initial;
    position: fixed; top: 20px; right: 20px; z-index: 2147483647;
  `;
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  // 3. Popup container (now scoped inside the shadow root)
  const popup = document.createElement('div');
  popup.style.cssText = `
    all: initial;
    display: flex; flex-direction: column;
    width: 380px; max-height: 400px; overflow: hidden;
    background: #1a1a1a; color: #e0e0e0; padding: 20px;
    border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px;
    border: 1px solid #333; box-sizing: border-box;
  `;

  // 4. Header
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;';
  header.innerHTML = `<b style="color: #4f9eff; font-size: 16px;">KashinAI</b>`;

  const closeBtn = document.createElement('button');
  closeBtn.innerText = 'X';
  closeBtn.style.cssText = 'background: none; border: none; color: #888; cursor: pointer; font-size: 16px; font-weight: bold;';
  closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
  closeBtn.onmouseout = () => closeBtn.style.color = '#888';
  closeBtn.onclick = () => host.remove();
  header.appendChild(closeBtn);

  // 5. Content Area (for showing AI responses)
  const content = document.createElement('div');
  content.style.cssText = 'flex-grow: 1; min-height: 0; overflow-y: auto; margin-bottom: 15px; line-height: 1.5;';

  const inputArea = document.createElement('div');
  inputArea.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-shrink: 0;';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.placeholder = 'Ask me anything...';
  textInput.style.cssText = 'all: revert; box-sizing: border-box; flex-grow: 1; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; padding: 8px; color: #fff; outline: none; font-family: inherit; font-size: 14px;';

  const micBtn = document.createElement('button');
  micBtn.innerText = 'Mic';
  micBtn.title = 'Speak';
  micBtn.style.cssText = 'all: revert; box-sizing: border-box; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; padding: 8px 12px; cursor: pointer; color: #fff; font-family: inherit;';

  const sendBtn = document.createElement('button');
  sendBtn.innerText = 'Send';
  sendBtn.style.cssText = 'all: revert; box-sizing: border-box; background: #007bff; border: none; border-radius: 6px; padding: 8px 15px; color: white; cursor: pointer; font-weight: bold; font-family: inherit;';

  inputArea.appendChild(textInput);
  inputArea.appendChild(micBtn);
  inputArea.appendChild(sendBtn);

  // 7. Assemble
  popup.appendChild(header);
  popup.appendChild(content);
  popup.appendChild(inputArea); // always shown
  root.appendChild(popup);

  // --- LOGIC ---

  let mediaRecorder;
  let audioChunks = [];

  const handleSendText = async (text) => {
    if (!text.trim()) return;
    content.innerHTML = '<i style="color:#888;">Thinking...</i>';
    try {
      const res = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { 'x-api-token': apiToken } : {})
        },
        body: JSON.stringify({ prompt: text })
      });
      const data = await res.json();
      content.innerHTML = `<b style="color:#4f9eff;">AI Response:</b><br><br>${data.response.replace(/\n/g, '<br>')}`;
    } catch (err) {
      content.innerHTML = '<span style="color:red;">Error connecting to backend.</span>';
    }
  };

  const submitFromInput = () => {
    const text = textInput.value;
    if (!text.trim()) return;
    textInput.value = '';
    handleSendText(text);
  };

  sendBtn.onclick = submitFromInput;
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitFromInput();
  });

  micBtn.onclick = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      micBtn.innerText = 'Mic';
      micBtn.style.background = '#2a2a2a';
      content.innerHTML = '<i style="color:#888;">Transcribing and Thinking...</i>';
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          try {
            const res = await fetch('http://localhost:3001/voice/query', {
              method: 'POST',
              headers: apiToken ? { 'x-api-token': apiToken } : {},
              body: formData
            });
            const data = await res.json();

            let html = '';
            if (data.transcript) {
              html += `<b style="color:#888;">You said:</b> ${data.transcript}<br><br>`;
            }
            if (data.error) {
              html += `<span style="color:#f87171;">${data.error}</span>`;
            } else {
              html += `<b style="color:#4f9eff;">AI Response:</b><br>${data.response.replace(/\n/g, '<br>')}`;
            }
            content.innerHTML = html;
          } catch (err) {
            content.innerHTML = '<span style="color:red;">Voice processing failed.</span>';
          }
        };

        mediaRecorder.start();
        micBtn.innerText = 'Stop';
        micBtn.style.background = '#ff4444';
        content.innerHTML = '<i style="color:#ff4444;">Listening... Click Stop when done.</i>';
      } catch (err) {
        alert('Microphone access denied or not available.');
      }
    }
  };

  if (selectedText) {
    handleSendText(selectedText);
  }
}