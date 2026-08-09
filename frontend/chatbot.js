// chatbot.js
const chatToggle = document.getElementById("chatToggle");
const chatWindow = document.getElementById("chatWindow");
const chatClose = document.getElementById("chatClose");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatMicBtn = document.getElementById("chatMicBtn");
const chatMuteBtn = document.getElementById("chatMuteBtn");

chatToggle.addEventListener("click", function () {
  chatWindow.classList.toggle("open");
  if (chatWindow.classList.contains("open") && chatMessages.children.length === 0) {
    addMessage("bot", "Hi! I am the Shopzon shopping assistant. Ask me about orders, shipping, returns, or tell me what you are looking for.");
  }
});

chatClose.addEventListener("click", function () {
  chatWindow.classList.remove("open");
});

chatForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) { return; }
  addMessage("user", text);
  chatInput.value = "";
  const typingBubble = addMessage("bot", "Typing...");
  const result = await getAIReply(text);
  typingBubble.textContent = result.reply;
  if (result.products && result.products.length > 0) {
    renderProductCardsInChat(result.products);
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
  speakReply(result.reply);
});

async function getAIReply(message) {
  let response;
  try {
    response = await fetch(API_URL + "/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message })
    });
  } catch (networkError) {
    return { reply: "I am having trouble connecting right now. Please make sure the site backend server is running and try again.", products: [] };
  }
  const data = await response.json();
  if (!response.ok) {
    console.error("Chat API error:", data.error);
    return { reply: "Sorry, I ran into a problem answering that. Please try again in a moment.", products: [] };
  }
  return { reply: data.reply, products: data.products || [] };
}

function renderProductCardsInChat(products) {
  const wrap = document.createElement("div");
  wrap.className = "chat-product-cards";

  products.forEach(function (product) {
    const card = document.createElement("a");
    card.className = "chat-product-card";
    card.href = "product.html?id=" + product.id;
    card.innerHTML =
      "<div class=\"chat-product-image\" style=\"background-image: url(\'" + product.image + "\');\"></div>" +
      "<div class=\"chat-product-title\">" + product.title + "</div>" +
      "<div class=\"chat-product-price\">Rs." + Number(product.price).toLocaleString("en-IN") + "</div>";
    wrap.appendChild(card);
  });

  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessage(sender, text) {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble " + sender;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const chatWakeToggle = document.getElementById("chatWakeToggle");
const WAKE_KEYWORDS = ["shop", "sharp", "zone", "zon", "jon", "john", "shawn", "shopzon"];

function isWakePhrase(transcript) {
  const hasHey = transcript.includes("hey");
  const hasKeyword = WAKE_KEYWORDS.some(function (word) {
    return transcript.includes(word);
  });
  return hasHey && hasKeyword;
}

if (!SpeechRecognitionAPI) {
  chatMicBtn.disabled = true;
  chatMicBtn.title = "Voice input is not supported in this browser";
  chatMicBtn.style.opacity = "0.4";
  if (chatWakeToggle) {
    chatWakeToggle.disabled = true;
    chatWakeToggle.style.opacity = "0.4";
  }
} else {
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-US";
  let mode = "idle";
  let wakeModeEnabled = false;

  chatMicBtn.addEventListener("click", function () {
    if (mode === "command") { recognition.stop(); return; }
    startCommandListening();
  });

  if (chatWakeToggle) {
    chatWakeToggle.addEventListener("click", function () {
      wakeModeEnabled = !wakeModeEnabled;
      chatWakeToggle.classList.toggle("active", wakeModeEnabled);
      chatWakeToggle.title = wakeModeEnabled ? "Wake word on" : "Enable wake word";
      if (wakeModeEnabled) {
        startWakeListening();
      } else if (mode === "wake") {
        recognition.stop();
      }
    });
  }

  function startWakeListening() {
    mode = "wake";
    recognition.continuous = true;
    recognition.interimResults = true;
    try { recognition.start(); } catch (err) { console.error("startWakeListening error:", err); }
  }

  function startCommandListening() {
    mode = "command";
    recognition.continuous = false;
    recognition.interimResults = false;
    try { recognition.start(); } catch (err) { recognition.stop(); }
  }

  recognition.addEventListener("start", function () {
    chatMicBtn.classList.add("listening");
    if (mode === "command") { chatInput.placeholder = "Listening..."; }
  });

  recognition.addEventListener("result", function (event) {
    if (mode === "wake") {
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (isWakePhrase(transcript)) {
          recognition.stop();
          if (!chatWindow.classList.contains("open")) {
            chatWindow.classList.add("open");
            if (chatMessages.children.length === 0) {
              addMessage("bot", "Hi! I am the Shopzon shopping assistant. Ask me about orders, shipping, returns, or tell me what you are looking for.");
            }
          }
          addMessage("bot", "I am listening...");
          startCommandListening();
          return;
        }
      }
      return;
    }
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    chatForm.requestSubmit();
  });

  recognition.addEventListener("end", function () {
    chatMicBtn.classList.remove("listening");
    chatInput.placeholder = "Ask a question...";
    if (mode === "command") {
      if (wakeModeEnabled) { startWakeListening(); } else { mode = "idle"; }
    } else if (mode === "wake" && wakeModeEnabled) {
      startWakeListening();
    }
  });

  recognition.addEventListener("error", function (event) {
    console.error("Speech recognition error:", event.error);
    if (event.error === "not-allowed" || event.error === "permission-denied") {
      wakeModeEnabled = false;
      mode = "idle";
      if (chatWakeToggle) { chatWakeToggle.classList.remove("active"); }
      addMessage("bot", "I do not have permission to use your microphone.");
    }
  });
}

let isMuted = false;

function updateMuteButtonIcon() {
  chatMuteBtn.innerHTML = isMuted
    ? "<i class=\"fa-solid fa-volume-xmark\"></i>"
    : "<i class=\"fa-solid fa-volume-high\"></i>";
  chatMuteBtn.title = isMuted ? "Unmute voice replies" : "Mute voice replies";
}

chatMuteBtn.addEventListener("click", function () {
  isMuted = !isMuted;
  updateMuteButtonIcon();
  if (isMuted) { window.speechSynthesis.cancel(); }
});

function speakReply(text) {
  if (isMuted) { return; }
  if (!("speechSynthesis" in window)) { return; }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}