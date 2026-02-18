const socket = io("/chat");

const form = document.getElementById("send-container");
const messageInput = document.getElementById("messageInp");
const messageContainer = document.querySelector(".container");

// Load sound
const audio = new Audio("/ting.mp3");

// Helper: current time as HH:MM
function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Append a structured message to chat box
// opts: { name, message, position: 'left'|'right', system: boolean }
function appendMessage(opts) {
  const { name, message, position = 'left', system = false } = opts || {};
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', position);

  if (system) {
    messageElement.classList.add('system');
    messageElement.innerText = message;
  } else {
    // name (optional)
    if (name) {
      const nameEl = document.createElement('div');
      nameEl.className = 'name';
      nameEl.innerText = name;
      messageElement.appendChild(nameEl);
    }

    // message text
    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.innerText = message;
    messageElement.appendChild(textEl);

    // time on the right
    const timeEl = document.createElement('span');
    timeEl.className = 'time';
    timeEl.innerText = timeNow();
    messageElement.appendChild(timeEl);
  }

  messageContainer.append(messageElement);

  // Play sound for received messages only
  if (position === 'left' && !system) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  // Auto scroll
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Ask username (rename to avoid colliding with window.name)
const username = prompt("Enter your name:");
socket.emit("new-user-joined", username);

// Someone joins
socket.on('user-joined', (name) => {
  appendMessage({ message: `${name} joined the chat`, position: 'left', system: true });
});

// When you send
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (message) {
    appendMessage({ name: 'You', message, position: 'right' });
    // send both name and message to the server to avoid relying solely on server-side mapping
    socket.emit('send', { name: username, message });
    messageInput.value = "";
  }
});

// When receiving a message
socket.on('receive', (data) => {
  // be defensive: data may be a string or an object
  if (typeof data === 'string') {
    appendMessage({ message: data, position: 'left' });
  } else {
    appendMessage({ name: data.name || '', message: data.message || '', position: 'left' });
  }
});

// When someone leaves
socket.on('left', (name) => {
  appendMessage({ message: `${name} left the chat`, position: 'left', system: true });
});
