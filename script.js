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

        const staticReplies = document.getElementById('bmQuickReplies');
        if (staticReplies) staticReplies.remove();

        setTimeout(() => {
            if (!this.sessionId) {
                this.sessionId = this.generateSessionId();
            }
            this.saveChatHistory();
        }, 1000);
    },

    generateSessionId: function() {
        return 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // ... остальные стандартные методы без изменений ...

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
        sendBtn.disabled = true;

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
            // Если бот говорит про файл, даём кнопку для popup
            if (data.response && data.response.toLowerCase().includes('файл')) {
                self.addMessage("Для загрузки файла используйте popup 👇", 'bot', [
                    {title: "Загрузить файл", value: "#popup:file_upload"}
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
        .finally(function() { sendBtn.disabled = false; self.saveChatHistory(); });
    },

    sendQuickReply: function(title, value) {
        this.addMessage(title, 'user');
        // Открытие popup по якорю Тильды
        if (value && value.startsWith('#popup:')) {
            window.location.hash = value.replace(':file_upload', `:file_upload?chat_id=${this.sessionId}`);
            return;
        }
        const input = document.getElementById('bmMessageInput');
        input.value = value === 'last_message' ? this.lastUserMessage : value;
        this.sendMessage();
    },

    // ... остальные стандартные методы без изменений ...
    // addMessage, showQuickReplies, scrollToBottom и пр.
};

document.addEventListener('DOMContentLoaded', function() {
    BMChat.init();
});
window.BMChat = BMChat;
