const BMChat = {
    isOpen: false,
    sessionId: null,
    currentState: null,
    lastUserMessage: '',
    webhookUrl: 'https://auto.golubef.store/webhook/chat-bm',

    init: function() {
        this.loadChatHistory();
        if (!this.sessionId) {
            this.sessionId = this.generateSessionId();
            this.saveChatHistory();
        }
        this.setupEventListeners();
        this.setupIOSFixes();
        setTimeout(() => {
            if (!this.sessionId) {
                this.sessionId = this.generateSessionId();
            }
            this.saveChatHistory();
        }, 1000);
    },

    pinHotButtonsBottom: function() {
        let pinned = document.getElementById('bm-hot-buttons-bottom');
        if (pinned) pinned.remove();

        pinned = document.createElement('div');
        pinned.id = 'bm-hot-buttons-bottom';
        pinned.style.cssText = 'display:flex;gap:8px;width:100%;padding:10px 0 6px 0;justify-content:center;background:#fff;';

        [
            { title: "Заявка", value: "/request" },
            { title: "Оператор", value: "/operator" },
            { title: "Файл", value: "/open_upload" }
        ].forEach(qr => {
            let btn = document.createElement('button');
            btn.textContent = qr.title;
            btn.className = 'bm-hot-btn';
            btn.onclick = () => BMChat.sendQuickReply(qr.title, qr.value);
            pinned.appendChild(btn);
        });

        let inputBox = document.getElementById('bmMessageInput');
        if (inputBox && inputBox.parentElement && inputBox.parentElement.parentElement) {
            inputBox.parentElement.parentElement.insertBefore(pinned, inputBox.parentElement);
        }
    },

    generateSessionId: function() {
        return 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    setupIOSFixes: function() {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no');
        }
        const textarea = document.getElementById('bmMessageInput');
        if (textarea) {
            textarea.addEventListener('focus', function() {
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
            });
            textarea.addEventListener('blur', function() {
                document.body.style.position = '';
                document.body.style.width = '';
            });
        }
    },

    setupEventListeners: function() {
        const self = this;
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && self.isOpen) {
                self.toggle();
            }
        });
        // Enter по input
        const input = document.getElementById('bmMessageInput');
        if(input) {
            input.addEventListener('keydown', function(e){
                if(e.key === 'Enter' && !e.shiftKey){
                    e.preventDefault();
                    BMChat.sendMessage();
                }
            });
        }
        const widget = document.getElementById('bmChatWidget');
        if (widget) {
            new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.target.classList.contains('show')) {
                        setTimeout(function() {
                            const input = document.getElementById('bmMessageInput');
                            if (input && window.innerWidth > 768) input.focus();
                        }, 300);
                    }
                });
            }).observe(widget, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    },

    toggle: function() {
        const widget = document.getElementById('bmChatWidget');
        const self = this;
        if (this.isOpen) {
            widget.classList.remove('show');
            setTimeout(function() { widget.style.display = 'none'; }, 400);
            this.isOpen = false;
        } else {
            widget.style.display = 'flex';
            setTimeout(function() { widget.classList.add('show'); }, 10);
            this.isOpen = true;
            const badge = document.querySelector('.bm-chat-badge');
            if (badge) badge.style.display = 'none';
            setTimeout(function() { self.scrollToBottom(); }, 100);
        }
    },

    sendMessage: function() {
        const input = document.getElementById('bmMessageInput');
        const message = input.value.trim();
        if (!message) return;

        if (!this.sessionId) {
            this.sessionId = this.generateSessionId();
            this.saveChatHistory();
        }

        this.lastUserMessage = message;
        this.addMessage(message, 'user');
        input.value = '';
        this.autoResize(input);
        this.showTyping();
        const sendBtn = document.getElementById('bmSendBtn');
        if(sendBtn) sendBtn.disabled = true;

        const self = this;
        const requestBody = {
            message: message,
            sessionId: this.sessionId,
            state: this.currentState,
            firstname: 'Посетитель',
            username: 'web_user',
            timestamp: new Date().toISOString()
        };

        fetch(this.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        })
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + response.statusText);
            return response.text();
        })
        .then(function(responseText) {
            if (!responseText || responseText.trim() === '') throw new Error('Пустой ответ от сервера');
            return JSON.parse(responseText);
        })
        .then(function(data) {
            self.hideTyping();
            if (data.response && data.response.toLowerCase().includes('файл')) {
                self.addMessage("Для загрузки файла используйте форму ниже 👇", 'bot', [
                    {title: "Загрузить файл", value: "/open_upload"}
                ]);
            } else {
                self.addMessage(data.response || 'Нет ответа', 'bot', data.quick_replies);
                if (data.state) self.currentState = data.state;
            }
        })
        .catch(function(error) {
            self.hideTyping();
            self.addMessage('❌ ОШИБКА: ' + error.message, 'bot', [
                {title: 'Попробовать снова', value: 'last_message'},
                {title: 'Оператор', value: '/operator'}
            ]);
        })
        .finally(function() { if(sendBtn) sendBtn.disabled = false; self.saveChatHistory(); });
    },

    sendQuickReply: function(title, value) {
        this.addMessage(title, 'user');
        if (value === "/open_upload") {
            const messagesContainer = document.getElementById('bmChatMessages');
            const oldIframe = messagesContainer.querySelector('.bm-upload-iframe');
            if (oldIframe) oldIframe.remove();

            const uploadDiv = document.createElement('div');
            uploadDiv.className = 'bm-upload-iframe';
            uploadDiv.innerHTML = `
                <iframe src="https://balt-market.site/upload?chat_id=${this.sessionId}" frameborder="0"
                style="width:100%;height:420px;border-radius:12px;border:1px solid #eee;background:#fff;margin-bottom:8px;" allow="camera;microphone"></iframe>
            `;
            messagesContainer.appendChild(uploadDiv);
            this.scrollToBottom();
            return;
        }
        const input = document.getElementById('bmMessageInput');
        input.value = value === 'last_message' ? this.lastUserMessage : value;
        this.sendMessage();
    },

    addMessage: function(content, sender, quickReplies) {
        const messagesContainer = document.getElementById('bmChatMessages');
        const existingReplies = messagesContainer.querySelectorAll('.bm-quick-replies, .bm-upload-btn, .bm-file-form');
        existingReplies.forEach(el => el.remove());
        const messageDiv = document.createElement('div');
        messageDiv.className = 'bm-message ' + sender;
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
        messageDiv.innerHTML = `<div class="bm-message-content">${content.replace(/\n/g, '<br>')}<div class="bm-message-time">${timeStr}</div></div>`;
        messagesContainer.appendChild(messageDiv);
        if (quickReplies && quickReplies.length > 0) this.showQuickReplies(quickReplies);
        this.scrollToBottom();
        if (sender === 'bot' && !this.isOpen) {
            const badge = document.querySelector('.bm-chat-badge');
            if (badge) badge.style.display = 'flex';
        }
    },

    showQuickReplies: function(replies) {
        const messagesContainer = document.getElementById('bmChatMessages');
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'bm-quick-replies';
        const self = this;
        replies.forEach(function(reply) {
            const button = document.createElement('button');
            button.textContent = reply.title;
            const value = reply.value === 'last_message' ? (self.lastUserMessage || '') : reply.value;
            button.onclick = function() { self.sendQuickReply(reply.title, value); };
            repliesContainer.appendChild(button);
        });
        messagesContainer.appendChild(repliesContainer);
        this.scrollToBottom();
    },

    showTyping: function() {
        const indicator = document.getElementById('bmTypingIndicator');
        if (indicator) { indicator.style.display = 'block'; this.scrollToBottom(); }
    },

    hideTyping: function() {
        const indicator = document.getElementById('bmTypingIndicator');
        if (indicator) indicator.style.display = 'none';
    },

    scrollToBottom: function() {
        const messages = document.getElementById('bmChatMessages');
        if (messages) { messages.scrollTop = messages.scrollHeight; }
    },

    autoResize: function(textarea) {
        textarea.style.height = '20px';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    },

    clearChat: function() {
        if (confirm('Очистить историю чата?')) {
            const messagesContainer = document.getElementById('bmChatMessages');
            messagesContainer.innerHTML = '<div class="bm-message bot"><div class="bm-message-content">Чат очищен. Готов к новым задачам!</div></div>';
            this.sessionId = this.generateSessionId();
            this.currentState = null;
            localStorage.removeItem('bm_chat_history');
            this.saveChatHistory();
            this.pinHotButtonsBottom();
        }
    },

    saveChatHistory: function() {
        const messages = document.getElementById('bmChatMessages');
        if (!messages) { return; }
        const chatData = {
            sessionId: this.sessionId,
            currentState: this.currentState,
            messages: messages.innerHTML,
            timestamp: Date.now()
        };
        try { localStorage.setItem('bm_chat_history', JSON.stringify(chatData)); } catch (error) { }
    },

    loadChatHistory: function() {
        const savedData = localStorage.getItem('bm_chat_history');
        const messagesContainer = document.getElementById('bmChatMessages');
        if (savedData) {
            try {
                const chatData = JSON.parse(savedData);
                if (Date.now() - chatData.timestamp > 24 * 60 * 60 * 1000) {
                    localStorage.removeItem('bm_chat_history');
                    return;
                }
                this.sessionId = chatData.sessionId;
                this.currentState = chatData.currentState || null;
                if (messagesContainer && chatData.messages) messagesContainer.innerHTML = chatData.messages;
            } catch (error) { localStorage.removeItem('bm_chat_history'); }
        } else {
            // Если истории нет — вставляем приветствие и ПРИКРЕПЛЯЕМ кнопки
            if (messagesContainer) {
                messagesContainer.innerHTML = `<div class="bm-message bot"><div class="bm-message-content">Приветствую! Я Балтик, цифровой снабженец 'Балт-Маркет'.<br><br>Задайте вопрос или используйте команды:<br>\`/заявка\` - для запроса КП<br>\`/оператор\` - для связи с инженером<br>\`/файл\` - чтобы прикрепить спецификацию</div></div>`;
            }
            this.pinHotButtonsBottom();
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    BMChat.init();
});
window.BMChat = BMChat;
